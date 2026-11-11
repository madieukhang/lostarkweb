import { MongoClient } from 'mongodb';

let connection;

const SEARCH_FIELDS = ['name', 'allCharacters'];
const DISPLAY_FIELDS = ['name', 'reason', 'imageUrl', 'allCharacters', 'addedByTag', 'addedAt'];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getErrorCode(error, env) {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (!env.MONGODB_URI || !env.MONGODB_DB || !env.MONGODB_COLLECTION) return 'MONGODB_CONFIG';
  if (message.includes('authentication') || message.includes('bad auth')) return 'MONGODB_AUTH';
  if (message.includes('timeout') || message.includes('server selection')) return 'MONGODB_TIMEOUT';
  return 'MONGODB_CONNECTION';
}

async function getCollection(env) {
  if (!env.MONGODB_URI || !env.MONGODB_DB || !env.MONGODB_COLLECTION) {
    throw new Error('Required MongoDB environment variables are missing.');
  }
  if (!connection) {
    const client = new MongoClient(env.MONGODB_URI, {
      connectTimeoutMS: 8000,
      serverSelectionTimeoutMS: 8000,
    });
    connection = client.connect().catch((error) => {
      connection = undefined;
      throw error;
    });
  }

  const database = (await connection).db(env.MONGODB_DB);
  return database.collection(env.MONGODB_COLLECTION);
}

export async function onRequestGet({ request, env }) {
  const query = (new URL(request.url).searchParams.get('q') || '').trim();
  const headers = {
    'Cache-Control': 'public, max-age=60',
    'Content-Type': 'application/json',
  };

  if (!query) {
    return new Response(JSON.stringify({ results: [] }), { headers });
  }

  try {
    const collection = await getCollection(env);
    const regex = { $regex: `^${escapeRegex(query)}`, $options: 'i' };
    const projection = Object.fromEntries(DISPLAY_FIELDS.map((field) => [field, 1]));
    const documents = await collection
      .find({ $or: SEARCH_FIELDS.map((field) => ({ [field]: regex })) }, { projection })
      .limit(10)
      .toArray();

    const results = documents.map((document) => {
      const result = { id: String(document._id) };
      DISPLAY_FIELDS.forEach((field) => {
        if (document[field] !== undefined) result[field] = document[field];
      });
      return result;
    });

    return new Response(JSON.stringify({ results }), { headers });
  } catch (error) {
    const errorCode = getErrorCode(error, env);
    console.error('MongoDB data query failed', {
      code: errorCode,
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    return new Response(JSON.stringify({ error: 'Không thể kết nối dữ liệu MongoDB.', code: errorCode }), {
      status: 500,
      headers,
    });
  }
}
