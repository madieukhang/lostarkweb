import { MongoClient } from 'mongodb';
import { DISPLAY_FIELDS, SEARCH_FIELDS } from '../config/schema.js';

let connection;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getCollection(env) {
  if (!connection) {
    const client = new MongoClient(env.MONGODB_URI);
    connection = client.connect().catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  const database = (await connection).db(env.MONGODB_DB);
  return database.collection(env.MONGODB_COLLECTION);
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' };
  if (query.length < 1) return new Response(JSON.stringify({ results: [] }), { headers });
  try {
    const fields = Object.fromEntries(DISPLAY_FIELDS.map((field) => [field, 1]));
    const collection = await getCollection(env);
    const regex = { $regex: `^${escapeRegex(query)}`, $options: 'i' };
    const documents = await collection.find({ $or: SEARCH_FIELDS.map((field) => ({ [field]: regex })) }, { projection: fields }).limit(10).toArray();
    const results = documents.map((document) => {
      const result = { id: String(document._id) };
      DISPLAY_FIELDS.forEach((field) => { if (document[field] !== undefined) result[field] = document[field]; });
      return result;
    });
    return new Response(JSON.stringify({ results }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: 'Không thể kết nối dữ liệu tìm kiếm.' }), { status: 500, headers });
  }
}
