import { client } from './api-generated/client.gen';

// Configure base URL — empty string because we use the /api/[...proxy] runtime proxy
client.setConfig({ baseUrl: '' });

export { client };
