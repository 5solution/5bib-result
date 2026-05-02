#!/bin/bash
# Upload 5Run Garmin branding logo to S3
# Run: bash upload-garmin-logo.sh

cd "$(dirname "$0")"

# Load AWS creds from backend .env
export $(grep ^AWS_ backend/.env | xargs)

pip install awscli --quiet 2>/dev/null || pip3 install awscli --quiet 2>/dev/null

aws s3 cp logo_5run_garmin_300x300.png \
  "s3://${AWS_S3_BUCKET}/branding/logo_5run_garmin_300x300.png" \
  --acl public-read \
  --content-type "image/png" \
  --region "${AWS_REGION}"

echo ""
echo "=== URL for Garmin Developer Portal ==="
echo "https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/branding/logo_5run_garmin_300x300.png"
