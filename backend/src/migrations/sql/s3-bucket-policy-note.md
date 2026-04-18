# S3 Bucket Policy — Team Management

**Bucket:** `5sport-media` (shared)

**Required policy** to serve avatar photos without per-object ACL:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TeamAvatarsPublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::5sport-media/team-photos/avatar/*"
    }
  ]
}
```

`team-photos/cccd/*` is intentionally NOT in this policy — CCCD photos are
private and served via presigned URLs (1h TTL) from `TeamPhotoService.presignCccd()`.

**Block Public Access:** keep BPA enabled at bucket level; the bucket policy
above grants narrow public GET on just the avatar prefix. If BPA blocks
bucket policies that grant public access, temporarily relax the
"Block public access granted through new public bucket policies" option
before applying, then re-apply BPA with that specific exception.

**Verify after apply:**
```bash
aws s3api put-object --bucket 5sport-media --key team-photos/avatar/smoke.txt --body /dev/null
curl -I "https://5sport-media.s3.ap-southeast-1.amazonaws.com/team-photos/avatar/smoke.txt"
# Expect: HTTP/1.1 200
aws s3api delete-object --bucket 5sport-media --key team-photos/avatar/smoke.txt
```
