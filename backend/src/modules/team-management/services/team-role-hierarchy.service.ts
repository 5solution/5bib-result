import { Injectable, Logger } from '@nestjs/common';
// Logger still used for cycle-detection warning.
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VolRole } from '../entities/vol-role.entity';
import { TeamCacheService } from './team-cache.service';

/**
 * v1.6 Option B2 — nested leader→managed role resolver.
 *
 * The `vol_role_manages` junction can form a DAG: Leader A → Leader B →
 * Crew + TNV, etc. We use BFS with a visited-set for cycle protection and
 * a hard depth cap so a misconfigured chain can never hang the service.
 *
 * Results are memoized in Redis under `team:leader:<id>:descendants` so
 * that hot paths (supply plan / allocations / item gate) don't re-BFS on
 * every request. Cache is invalidated from the role CRUD layer.
 */
@Injectable()
export class TeamRoleHierarchyService {
  private readonly logger = new Logger(TeamRoleHierarchyService.name);

  // Safety rail — matches the "max 5 tầng" message shown in admin UI.
  static readonly DEFAULT_MAX_DEPTH = 5;
  // Cache TTL kept short — hierarchy rarely changes but we want admin
  // tweaks to propagate quickly (60s aligns with supply plan cache).
  static readonly CACHE_TTL_SECONDS = 60;

  constructor(
    @InjectRepository(VolRole, 'volunteer')
    private readonly roleRepo: Repository<VolRole>,
    private readonly cache: TeamCacheService,
  ) {}

  static cacheKey(leaderRoleId: number): string {
    return `team:leader:${leaderRoleId}:descendants`;
  }

  /**
   * BFS from leader role. Returns the Set of role IDs the leader has
   * authority over (excluding the leader's own role by default — pass
   * `includeSelf=true` to include it).
   *
   * Opts:
   *  - maxDepth (default 5) — hard cap; deeper edges silently truncated.
   *  - includeSelf (default false) — whether to add leaderRoleId to result.
   */
  async resolveDescendantRoleIds(
    leaderRoleId: number,
    opts?: { maxDepth?: number; includeSelf?: boolean },
  ): Promise<Set<number>> {
    const cacheKey = TeamRoleHierarchyService.cacheKey(leaderRoleId);
    const cached = await this.cache.getJson<number[]>(cacheKey);
    if (cached) {
      const set = new Set(cached);
      if (opts?.includeSelf) set.add(leaderRoleId);
      return set;
    }

    const maxDepth = opts?.maxDepth ?? TeamRoleHierarchyService.DEFAULT_MAX_DEPTH;
    const visited = new Set<number>();
    const result = new Set<number>();
    const queue: Array<{ id: number; depth: number }> = [
      { id: leaderRoleId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      // Direct children via junction. We could batch all depths by preloading
      // the whole junction table, but per-level SQL keeps the query simple
      // and exits early for small hierarchies.
      const children = await this.roleRepo
        .createQueryBuilder('r')
        .innerJoin('vol_role_manages', 'rm', 'rm.managed_role_id = r.id')
        .where('rm.leader_role_id = :id', { id })
        .getMany();

      for (const child of children) {
        if (!result.has(child.id)) {
          result.add(child.id);
          queue.push({ id: child.id, depth: depth + 1 });
        }
      }
    }

    await this.cache.setJson(
      cacheKey,
      Array.from(result),
      TeamRoleHierarchyService.CACHE_TTL_SECONDS,
    );
    if (opts?.includeSelf) result.add(leaderRoleId);
    return result;
  }

  /**
   * Drop the memoized BFS result. Called from role CRUD whenever the
   * junction rows for this leader change. Pass `undefined` to scan-delete
   * every leader's cache (used when a structural change cascades — e.g.
   * admin edits a mid-tree leader whose parents also depend on this path).
   */
  async invalidateHierarchy(leaderRoleId?: number): Promise<void> {
    if (leaderRoleId !== undefined) {
      await this.cache.del(TeamRoleHierarchyService.cacheKey(leaderRoleId));
    } else {
      await this.cache.scanDel('team:leader:*:descendants');
    }
  }

  /**
   * Cycle-prevention helper. Given a prospective edge set (leader →
   * proposedManagedIds), simulate a BFS that ALSO follows existing junction
   * edges; if we ever re-visit `leaderRoleId`, the new config would create
   * a cycle. Returns `true` when safe, `false` when a cycle would form.
   */
  async wouldCreateCycle(
    leaderRoleId: number,
    proposedManagedIds: number[],
  ): Promise<boolean> {
    if (proposedManagedIds.length === 0) return false;
    // Self-edge short-circuit.
    if (proposedManagedIds.includes(leaderRoleId)) return true;

    const visited = new Set<number>();
    const queue: number[] = [...proposedManagedIds];
    // Depth cap higher than normal — cycle detection must walk the full
    // reachable graph, not just 5 tiers.
    const maxIter = 500;
    let iter = 0;

    while (queue.length > 0) {
      if (++iter > maxIter) {
        // If we haven't found a cycle within 500 nodes, bail out pessimistic
        // — real hierarchies won't come close to this, and a runaway loop is
        // itself a signal of misconfig.
        this.logger.warn(
          `wouldCreateCycle aborted after ${maxIter} iterations (leader=${leaderRoleId})`,
        );
        return true;
      }
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      if (id === leaderRoleId) return true;

      const children = await this.roleRepo
        .createQueryBuilder('r')
        .innerJoin('vol_role_manages', 'rm', 'rm.managed_role_id = r.id')
        .where('rm.leader_role_id = :id', { id })
        .getMany();
      for (const c of children) {
        if (!visited.has(c.id)) queue.push(c.id);
      }
    }
    return false;
  }
}
