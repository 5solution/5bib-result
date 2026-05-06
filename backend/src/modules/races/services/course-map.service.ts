import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { DOMParser } from '@xmldom/xmldom';
import { gpx as toGeoJsonGpx, kml as toGeoJsonKml } from '@tmcw/togeojson';
import { length as turfLength, simplify as turfSimplify } from '@turf/turf';
import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  Position,
} from 'geojson';

import { env } from '../../../config';
import { Race, RaceDocument } from '../schemas/race.schema';
import {
  CheckpointWithPositionDto,
  CourseMapDataDto,
} from '../dto/course-map-data.dto';
import { GpxBoundsDto, GpxParsedDto } from '../dto/gpx-parsed.dto';
import { WaypointMatchDto } from '../dto/course-map-upload-result.dto';

/**
 * Internal shape returned by parseGpxOrKml.
 *
 * `simplifiedGeoJson` is a Feature<LineString> ready to upload as
 * `simplified.geojson`. `waypoints` are the original GPX `<wpt>` / KML
 * `<Placemark>` Points with their name, used by matchWaypoints.
 */
export interface ParsedGpxOrKml {
  gpxParsed: GpxParsedDto;
  simplifiedGeoJson: Feature<LineString>;
  waypoints: WaypointInfo[];
}

export interface WaypointInfo {
  name: string;
  lat: number;
  lng: number;
}

export interface MatchedWaypoint extends WaypointMatchDto {}

export interface MatchWaypointsResult {
  matched: MatchedWaypoint[];
  unmatchedKeys: string[];
}

const SIMPLIFY_TOLERANCE = 0.0001; // ~10 m at the equator (BR-CM-02)
const MAX_SIMPLIFIED_POINTS = 5000; // BR-CM-02 hard ceiling
const ELEVATION_NOISE_M = 0.5; // BR-CM-06 — ignore deltas below this
const CACHE_TTL_SECONDS = 600;
const CACHE_LOCK_TTL_SECONDS = 30;

const cacheKey = (raceId: string, courseId: string) =>
  `master:course-map:${raceId}:${courseId}`;
const lockKey = (raceId: string, courseId: string) =>
  `master:course-map-lock:${raceId}:${courseId}`;

/**
 * GPX/KML parsing, server-side simplification, S3 storage, public map-data
 * caching, and waypoint↔checkpoint auto-matching for FEATURE-006.
 *
 * Every public method below is reachable via `RacesController`'s 4 new
 * endpoints OR explicitly tagged `@internal` to comply with BR-CC-10
 * (no dead code).
 */
@Injectable()
export class CourseMapService {
  private readonly logger = new Logger(CourseMapService.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectRedis() private readonly redis: Redis,
  ) {
    this.bucket = env.s3.bucket;
    this.region = env.s3.region;
    this.s3Client = new S3Client({ region: this.region });
  }

  // ─── Parse + simplify ────────────────────────────────────────────

  /**
   * Parse a GPX or KML buffer, simplify the track to ≤5000 points
   * (BR-CM-02), compute distance + elevation stats with a 0.5 m noise
   * filter (BR-CM-06), and validate WGS84 bounds (BR-CM-03).
   *
   * Reachable via POST /admin/.../gpx (uploadGpx flow).
   */
  async parseGpxOrKml(buffer: Buffer, filename: string): Promise<ParsedGpxOrKml> {
    const xml = buffer.toString('utf-8');
    const lower = filename.toLowerCase();
    const isKml = lower.endsWith('.kml');
    const isGpx = lower.endsWith('.gpx');
    if (!isGpx && !isKml) {
      throw new BadRequestException('Chỉ chấp nhận file .gpx hoặc .kml');
    }

    let doc: Document;
    try {
      // @xmldom/xmldom Document is a structural subset of the DOM Document
      // — togeojson accepts both. Cast through unknown to satisfy TS.
      doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
    } catch {
      throw new BadRequestException('File GPX không hợp lệ: malformed XML');
    }

    let collection: FeatureCollection;
    try {
      collection = isKml ? toGeoJsonKml(doc) : toGeoJsonGpx(doc);
    } catch (err) {
      this.logger.warn(`togeojson threw on ${filename}: ${(err as Error).message}`);
      throw new BadRequestException('File GPX không hợp lệ: parse error');
    }

    // 1. Find the track feature — first LineString OR longest if MultiLineString
    const trackCoords = this.extractTrackCoordinates(collection);
    if (trackCoords.length < 2) {
      throw new BadRequestException(
        'File GPX không hợp lệ: thiếu track points (cần ít nhất 2 điểm)',
      );
    }

    // 2. Validate WGS84 bounds (BR-CM-03)
    for (const [lng, lat] of trackCoords) {
      if (
        !Number.isFinite(lng) ||
        !Number.isFinite(lat) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        throw new BadRequestException(
          'File GPX có toạ độ không hợp lệ (ngoài bounds WGS84)',
        );
      }
    }

    const trackPoints = trackCoords.length;

    // 3. Simplify (Douglas-Peucker via @turf/simplify)
    const lineFeature: Feature<LineString> = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: trackCoords },
    };
    let simplified = turfSimplify(lineFeature, {
      tolerance: SIMPLIFY_TOLERANCE,
      highQuality: false,
      mutate: false,
    }) as Feature<LineString>;

    // Hard ceiling: if still over MAX_SIMPLIFIED_POINTS, ramp tolerance up
    let safety = 0;
    let tol = SIMPLIFY_TOLERANCE;
    while (
      simplified.geometry.coordinates.length > MAX_SIMPLIFIED_POINTS &&
      safety < 10
    ) {
      tol *= 2;
      simplified = turfSimplify(lineFeature, {
        tolerance: tol,
        highQuality: false,
        mutate: false,
      }) as Feature<LineString>;
      safety += 1;
    }
    const simplifiedPoints = simplified.geometry.coordinates.length;

    // 4. Distance — compute from ORIGINAL track for accuracy (km)
    const totalDistanceKm = Number(
      turfLength(lineFeature, { units: 'kilometers' }).toFixed(3),
    );

    // 5. Elevation — extract from original 3D coordinates if present
    const elevations: number[] = [];
    for (const coord of trackCoords) {
      if (coord.length >= 3 && Number.isFinite(coord[2])) {
        elevations.push(coord[2]);
      }
    }
    const elevation = this.computeElevationStats(elevations);

    // 6. Bounds (from original)
    const bounds = this.computeBounds(trackCoords);

    // 7. Waypoints (BR-CM-04 source)
    const waypoints = this.extractWaypoints(collection);

    const gpxParsed: GpxParsedDto = {
      trackPoints,
      simplifiedPoints,
      totalDistanceKm,
      elevationGain: elevation.gain,
      elevationLoss: elevation.loss,
      maxElevation: elevation.max,
      minElevation: elevation.min,
      bounds,
    };

    return { gpxParsed, simplifiedGeoJson: simplified, waypoints };
  }

  /**
   * Strict 3-level waypoint↔checkpoint matcher (BR-CM-04). Returns matched
   * checkpoints with assigned lat/lng plus the keys that did NOT match
   * (admin must drag manually per BR-CM-05).
   *
   * NEVER substring/Levenshtein — that would false-positive `TM10` ↔ `TM1`.
   *
   * Reachable via POST /admin/.../gpx (uploadGpx flow).
   */
  matchWaypoints(
    waypoints: WaypointInfo[],
    checkpoints: { key: string }[],
  ): MatchWaypointsResult {
    const matched: MatchedWaypoint[] = [];
    const unmatchedKeys: string[] = [];

    for (const cp of checkpoints) {
      // L1 exact (case-sensitive)
      const l1 = waypoints.find((w) => w.name === cp.key);
      if (l1) {
        matched.push({ key: cp.key, lat: l1.lat, lng: l1.lng, matchType: 'exact' });
        this.logger.log(`matched exact: waypoint "${l1.name}" → checkpoint "${cp.key}"`);
        continue;
      }
      // L2 case-insensitive
      const cpLower = cp.key.toLowerCase();
      const l2 = waypoints.find((w) => w.name.toLowerCase() === cpLower);
      if (l2) {
        matched.push({
          key: cp.key,
          lat: l2.lat,
          lng: l2.lng,
          matchType: 'case-insensitive',
        });
        this.logger.warn(
          `case mismatch normalized: waypoint "${l2.name}" → checkpoint "${cp.key}"`,
        );
        continue;
      }
      // L3 no match
      this.logger.warn(`no match — manual drag required: checkpoint "${cp.key}"`);
      unmatchedKeys.push(cp.key);
    }

    return { matched, unmatchedKeys };
  }

  // ─── S3 storage ──────────────────────────────────────────────────

  /**
   * Upload original GPX/KML + simplified GeoJSON to S3 under
   * `courses/<raceId>/<courseId>/`. If existing files are present they are
   * deleted first so the new upload becomes the single source of truth
   * (BR-CM-01 replace semantics).
   *
   * Bucket policy controls public-read for `courses/*` (Clarification 5
   * in 02-manager-plan.md). We do NOT set per-object ACL — most 5BIB
   * buckets reject `public-read` because Block Public Access is enabled
   * (matches the team-photos pattern).
   *
   * Reachable via POST /admin/.../gpx.
   */
  async uploadGpxToS3(
    raceId: string,
    courseId: string,
    original: Buffer,
    simplifiedGeoJson: object,
    originalFilename: string,
  ): Promise<{ gpxUrl: string; gpxSimplifiedUrl: string }> {
    const isKml = originalFilename.toLowerCase().endsWith('.kml');
    const ext = isKml ? 'kml' : 'gpx';
    const contentType = isKml
      ? 'application/vnd.google-earth.kml+xml'
      : 'application/gpx+xml';

    const baseKey = `courses/${raceId}/${courseId}`;
    const originalKey = `${baseKey}/original.${ext}`;
    const altOriginalKey = `${baseKey}/original.${ext === 'gpx' ? 'kml' : 'gpx'}`;
    const simplifiedKey = `${baseKey}/simplified.geojson`;

    // Replace logic — delete the OTHER format too in case BTC switches gpx↔kml
    await Promise.all([
      this.safeDelete(originalKey),
      this.safeDelete(altOriginalKey),
      this.safeDelete(simplifiedKey),
    ]);

    await Promise.all([
      this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: originalKey,
          Body: original,
          ContentType: contentType,
        }),
      ),
      this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: simplifiedKey,
          Body: Buffer.from(JSON.stringify(simplifiedGeoJson)),
          ContentType: 'application/geo+json',
        }),
      ),
    ]);

    return {
      gpxUrl: this.publicUrl(originalKey),
      gpxSimplifiedUrl: this.publicUrl(simplifiedKey),
    };
  }

  /**
   * Delete both original (gpx OR kml) + simplified.geojson keys for a course.
   * Graceful on missing keys — never throws on S3 NoSuchKey.
   *
   * Reachable via DELETE /admin/.../gpx.
   */
  async deleteGpxFromS3(raceId: string, courseId: string): Promise<void> {
    const baseKey = `courses/${raceId}/${courseId}`;
    await Promise.all([
      this.safeDelete(`${baseKey}/original.gpx`),
      this.safeDelete(`${baseKey}/original.kml`),
      this.safeDelete(`${baseKey}/simplified.geojson`),
    ]);
  }

  // ─── Public map-data with cache + anti-stampede ──────────────────

  /**
   * Get the public map-data for a course. Behaviour:
   *
   *   1. Cache hit → return JSON (TTL 600 s).
   *   2. Cache miss + lock acquired → recompute, set cache, return.
   *   3. Cache miss + lock contended → brief poll loop reads cache once
   *      the winner finishes (anti-stampede per F-005 2-layer pattern).
   *
   * Visibility rule (BR-CM-07 + Concern 1):
   *   - race not found OR race.status === 'draft' → throw NotFoundException
   *     (controller maps to 404).
   *   - race.status >= 'pre_race' AND no GPX → returns 200 with `hasGpx: false`.
   *
   * Reachable via GET /api/races/:raceId/courses/:courseId/map-data.
   */
  async getCachedMapData(
    raceId: string,
    courseId: string,
  ): Promise<CourseMapDataDto> {
    const cKey = cacheKey(raceId, courseId);

    // Tier 1: cache
    const cached = await this.safeGetCache(cKey);
    if (cached) return cached;

    // Tier 2: SETNX lock anti-stampede
    const lKey = lockKey(raceId, courseId);
    const acquired = await this.tryAcquireLock(lKey);
    if (!acquired) {
      // Brief wait for the winner to populate cache. Bounded so a stuck
      // winner cannot block the request indefinitely.
      const polled = await this.pollCacheWhileLocked(cKey, lKey);
      if (polled) return polled;
      // Lock expired without a cache fill — fall through and recompute
      // ourselves so the caller still gets a response.
    }

    try {
      const fresh = await this.computeMapData(raceId, courseId);
      await this.safeSetCache(cKey, fresh);
      return fresh;
    } finally {
      if (acquired) {
        try {
          await this.redis.del(lKey);
        } catch {
          /* lock auto-expires anyway */
        }
      }
    }
  }

  /**
   * Invalidate the public map-data cache for a course. Called by
   * RacesService.updateCourse and the 3 admin endpoints (POST/DELETE/PATCH).
   *
   * Public so it is reachable from `RacesController.uploadGpx` and friends.
   */
  async invalidateMapDataCache(raceId: string, courseId: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(raceId, courseId));
    } catch {
      /* Redis down — non-fatal */
    }
  }

  // ─── Internal compute (called from getCachedMapData) ─────────────

  private async computeMapData(
    raceId: string,
    courseId: string,
  ): Promise<CourseMapDataDto> {
    const race = await this.raceModel.findById(raceId).lean().exec();
    if (!race || race.status === 'draft') {
      // BR-CM-07 — public callers cannot see drafts. NotFoundException so
      // the controller maps to 404 without leaking existence.
      throw new NotFoundException('Course map not available');
    }
    const course = (race.courses ?? []).find((c) => c.courseId === courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const checkpoints: CheckpointWithPositionDto[] = (course.checkpoints ?? []).map(
      (cp) => ({
        key: cp.key,
        name: cp.name,
        distance: cp.distance,
        distanceKm: cp.distanceKm,
        lat: cp.lat,
        lng: cp.lng,
        services: cp.services as unknown as
          | Record<string, boolean | string | undefined>
          | undefined,
      }),
    );

    if (!course.gpxSimplifiedUrl || !course.gpxParsed) {
      // Concern 1 — pre_race race without uploaded GPX renders empty state
      return { hasGpx: false, checkpoints };
    }

    return {
      hasGpx: true,
      gpxSimplifiedUrl: course.gpxSimplifiedUrl,
      gpxParsed: course.gpxParsed as GpxParsedDto,
      checkpoints,
      bounds: course.gpxParsed.bounds as GpxBoundsDto,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  private extractTrackCoordinates(collection: FeatureCollection): Position[] {
    let best: Position[] = [];
    for (const feature of collection.features) {
      if (!feature.geometry) continue;
      if (feature.geometry.type === 'LineString') {
        const coords = (feature.geometry as LineString).coordinates;
        if (coords.length > best.length) best = coords;
      } else if (feature.geometry.type === 'MultiLineString') {
        const all = (feature.geometry as MultiLineString).coordinates.flat();
        if (all.length > best.length) best = all;
      }
    }
    return best;
  }

  private extractWaypoints(collection: FeatureCollection): WaypointInfo[] {
    const out: WaypointInfo[] = [];
    for (const feature of collection.features) {
      if (!feature.geometry || feature.geometry.type !== 'Point') continue;
      const coords = (feature.geometry as Point).coordinates;
      if (coords.length < 2) continue;
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const rawName = props['name'];
      const name = typeof rawName === 'string' ? rawName.trim() : '';
      if (!name) continue;
      out.push({ name, lat: coords[1], lng: coords[0] });
    }
    return out;
  }

  private computeElevationStats(elevations: number[]): {
    gain: number | null;
    loss: number | null;
    max: number | null;
    min: number | null;
  } {
    if (elevations.length === 0) {
      return { gain: null, loss: null, max: null, min: null };
    }
    let gain = 0;
    let loss = 0;
    let max = elevations[0];
    let min = elevations[0];
    for (let i = 1; i < elevations.length; i++) {
      const delta = elevations[i] - elevations[i - 1];
      if (Math.abs(delta) < ELEVATION_NOISE_M) continue;
      if (delta > 0) gain += delta;
      else loss += -delta;
    }
    for (const e of elevations) {
      if (e > max) max = e;
      if (e < min) min = e;
    }
    return {
      gain: Math.round(gain),
      loss: Math.round(loss),
      max: Math.round(max),
      min: Math.round(min),
    };
  }

  private computeBounds(coords: Position[]): GpxBoundsDto {
    let north = -Infinity;
    let south = Infinity;
    let east = -Infinity;
    let west = Infinity;
    for (const [lng, lat] of coords) {
      if (lat > north) north = lat;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lng < west) west = lng;
    }
    return { north, south, east, west };
  }

  private publicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private async safeDelete(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      // S3 DeleteObject is idempotent (returns 204 even on missing key);
      // any error here is auth / network — log and swallow per Clarification 4.
      this.logger.debug(`S3 delete swallowed for ${key}: ${(err as Error).message}`);
    }
  }

  private async safeGetCache(key: string): Promise<CourseMapDataDto | null> {
    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as CourseMapDataDto;
    } catch {
      return null;
    }
  }

  private async safeSetCache(key: string, value: CourseMapDataDto): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch {
      /* non-fatal */
    }
  }

  private async tryAcquireLock(key: string): Promise<boolean> {
    try {
      const res = await this.redis.set(key, '1', 'EX', CACHE_LOCK_TTL_SECONDS, 'NX');
      return res === 'OK';
    } catch {
      // If Redis is down, behave as if we acquired the lock — otherwise
      // every miss would deadlock waiting for a lock we cannot read.
      return true;
    }
  }

  private async pollCacheWhileLocked(
    cKey: string,
    lKey: string,
  ): Promise<CourseMapDataDto | null> {
    const start = Date.now();
    const maxWaitMs = 2000;
    const stepMs = 50;
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, stepMs));
      const cached = await this.safeGetCache(cKey);
      if (cached) return cached;
      // Stop polling if the lock disappeared — winner crashed without
      // populating cache, so we should fall through and compute ourselves.
      try {
        const exists = await this.redis.exists(lKey);
        if (exists === 0) return null;
      } catch {
        return null;
      }
    }
    return null;
  }
}
