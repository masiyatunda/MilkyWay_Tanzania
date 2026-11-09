import { Room } from 'livekit-client';

/**
 * Inaomba token kutoka kwa backend na kuunganisha kwenye chumba cha LiveKit.
 * Inajumuisha ulinzi kamili wa majibu yasiyo JSON ili kuzuia kosa la "Unexpected token '<'".
 */
export async function connectToLiveRoom(tokenEndpoint: string, roomName: string, userId: string): Promise<Room> {
  const endpoint = tokenEndpoint || import.meta.env.VITE_TOKEN_ENDPOINT;
  const wsUrl = import.meta.env.VITE_LIVEKIT_URL;

  if (!wsUrl) {
    throw new Error('VITE_LIVEKIT_URL haijatdefined kwenye environment variables.');
  }

  // 1. Omba token kwa njia salama
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ room: roomName, identity: userId }),
  });

  // 2. Angalia kama ombi limefanikiwa (HTTP 200 OK)
  if (!res.ok) {
    const errorText = await res.text();
    console.error('Token endpoint error:', res.status, errorText.slice(0, 200));
    throw new Error(`Imeshindwa kupata token ya LiveKit (Status: ${res.status})`);
  }

  // 3. Ulinzi wa Content-Type kuzuia kosa la HTML kuingia badala ya JSON
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const htmlPreview = await res.text();
    console.error('Seva imerudisha HTML badala ya JSON:', htmlPreview.slice(0, 150));
    throw new Error('Seva imerudisha jibu lisilo JSON (Unexpected HTML). Angalia URL yako ya backend.');
  }

  // 4. Soma JSON na uunganishe kwenye chumba cha LiveKit
  const data = await res.json();
  if (!data.token) {
    throw new Error('Jibu la seva halina ufunguo wa "token".');
  }

  const room = new Room();
  await room.connect(wsUrl, data.token);

  return room;
}