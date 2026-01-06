# Railway Private Network Configuration

## The Issue

The error `wrong version number` occurs when:
- You use **HTTPS** to connect to an **HTTP** endpoint
- Railway's private IPv6 network uses **HTTP** (not HTTPS) on port 9200

## Solution

### 1. Find Your Elasticsearch Service Name

In Railway dashboard:
1. Go to your Elasticsearch service
2. Check the service name (e.g., "elasticsearch", "es", etc.)

### 2. Update Your .env File

Use Railway's private network format:

```bash
# ✅ Correct - HTTP with .railway.internal domain
ELASTICSEARCH_NODE=http://elasticsearch.railway.internal:9200

# ✅ Correct - HTTP with direct IPv6 address
ELASTICSEARCH_NODE=http://[fd12:3456:789a:1::1]:9200

# ❌ Wrong - Using HTTPS on private network
ELASTICSEARCH_NODE=https://elasticsearch.railway.internal:9200

# ❌ Wrong - Using public URL with HTTPS
ELASTICSEARCH_NODE=https://elasticsearch-production-1bda.up.railway.app/
```

### 3. Railway Service Discovery

Railway provides automatic service discovery via `.railway.internal` domains:

**Format:**
```
http://[SERVICE-NAME].railway.internal:[PORT]
```

**Examples:**
```bash
# If your Elasticsearch service is named "elasticsearch"
ELASTICSEARCH_NODE=http://elasticsearch.railway.internal:9200

# If your Elasticsearch service is named "es"
ELASTICSEARCH_NODE=http://es.railway.internal:9200

# If your Elasticsearch service is named "elastic-search"
ELASTICSEARCH_NODE=http://elastic-search.railway.internal:9200
```

### 4. How to Find the Correct Service Name

**Method 1: Railway Dashboard**
1. Open your Railway project
2. Click on the Elasticsearch service
3. Go to "Settings" tab
4. The service name is shown at the top

**Method 2: Environment Variables**
Railway exposes service information via environment variables:
```bash
# Check Railway-generated variables
echo $RAILWAY_SERVICE_NAME
```

**Method 3: DNS Query (from another service)**
```bash
# From your app container
nslookup elasticsearch.railway.internal
```

## Complete Configuration

### .env File
```bash
# Elasticsearch Configuration
# Railway Private Network (IPv6) - Use HTTP not HTTPS
ELASTICSEARCH_NODE=http://elasticsearch.railway.internal:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your_password_here
```

### Module Configuration (Already Updated)

The `race-result.module.ts` now includes TLS configuration for flexible connection:

```typescript
ElasticsearchModule.register({
  node: env.elasticsearch.node,
  auth: {
    username: env.elasticsearch.username,
    password: env.elasticsearch.password,
  },
  tls: {
    rejectUnauthorized: false, // For Railway's self-signed certs
  },
})
```

## Testing the Connection

### 1. From Your Local Machine (Won't Work)
```bash
# This will fail - private network is not accessible externally
curl http://elasticsearch.railway.internal:9200
```

### 2. From Within Railway (Use Railway CLI)
```bash
# SSH into your service
railway shell

# Test connection
curl http://elasticsearch.railway.internal:9200

# Test with auth
curl -u elastic:your_password http://elasticsearch.railway.internal:9200
```

### 3. From Your Application Logs
Check the logs when the app starts:
```bash
railway logs
```

Look for:
- ✅ `Index race-results created successfully`
- ✅ `Successfully synced X results for...`
- ❌ `Error creating index: Connection refused`
- ❌ `wrong version number` (means HTTP/HTTPS mismatch)

## Common Issues & Solutions

### Issue 1: "Connection Refused"
**Cause:** Service name is incorrect or service isn't running

**Solution:**
```bash
# Verify service name in Railway dashboard
# OR use the public URL temporarily for debugging:
ELASTICSEARCH_NODE=http://elasticsearch-production-1bda.up.railway.app:9200
```

### Issue 2: "Wrong Version Number"
**Cause:** HTTPS/HTTP mismatch

**Solution:**
```bash
# Change from HTTPS to HTTP
# Before: https://...
# After:  http://...
ELASTICSEARCH_NODE=http://elasticsearch.railway.internal:9200
```

### Issue 3: "Authentication Failed"
**Cause:** Incorrect username/password

**Solution:**
```bash
# Check Elasticsearch service variables in Railway
# Update credentials in .env
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=correct_password
```

### Issue 4: "Name Resolution Failed"
**Cause:** Service not available via private network

**Solution:**
```bash
# Option 1: Use exact service name from Railway
ELASTICSEARCH_NODE=http://[exact-service-name].railway.internal:9200

# Option 2: Use direct IPv6 (get from Railway dashboard)
ELASTICSEARCH_NODE=http://[fd12:3456:789a:1::1]:9200

# Option 3: Fallback to public URL
ELASTICSEARCH_NODE=https://elasticsearch-production-1bda.up.railway.app:9200
```

## IPv6 Address Format

If using direct IPv6 addresses:

```bash
# ✅ Correct - IPv6 wrapped in brackets
ELASTICSEARCH_NODE=http://[fd12:3456:789a:1::1]:9200
ELASTICSEARCH_NODE=http://[::1]:9200

# ❌ Wrong - Missing brackets
ELASTICSEARCH_NODE=http://fd12:3456:789a:1::1:9200
```

## Benefits of Private Network

✅ **Faster** - No internet roundtrip
✅ **Cheaper** - No egress bandwidth charges
✅ **Secure** - Not exposed to internet
✅ **Lower Latency** - Direct IPv6 connection

## Verification Steps

1. **Update .env** with `http://[service-name].railway.internal:9200`
2. **Rebuild and deploy** your application
3. **Check logs** for successful connection
4. **Trigger manual sync**: `POST /api/race-results/sync`
5. **Query results**: `GET /api/race-results?pageSize=10`

## Debugging Commands

```bash
# Railway CLI - Check service status
railway status

# Railway CLI - View logs
railway logs

# Railway CLI - Shell into service
railway shell

# Inside shell - Test Elasticsearch
curl -v http://elasticsearch.railway.internal:9200
curl -u elastic:password http://elasticsearch.railway.internal:9200/_cluster/health
```

## Production Checklist

- [ ] Use Railway private network (`.railway.internal`)
- [ ] Use HTTP (not HTTPS) for private network
- [ ] Set `rejectUnauthorized: false` for Railway's certs
- [ ] Use strong passwords in production
- [ ] Enable Railway environment-specific configs
- [ ] Monitor logs for connection errors
- [ ] Test sync endpoint after deployment
