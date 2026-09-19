// Puente para las pruebas cruzadas: ejecuta el cifrado REAL del frontend (compilado) en Node.
// Uso: node js_bridge.js <dir-compilado>  (lee un JSON por stdin, escribe un JSON por stdout)
globalThis.window = globalThis;
const dir = process.argv[2];
const env = require(`${dir}/envelope.js`);
const box = require(`${dir}/sealedBox.js`);
const payload = require(`${dir}/payload.js`);
const enc = require(`${dir}/encoding.js`);

const b = s => enc.base64ToBytes(s);
const s = u => enc.bytesToBase64(u);

async function run(op) {
  switch (op.op) {
    case 'seal': {
      const pt = await payload.encodePayload(op.message, op.files.map(f => new File([b(f.data)], f.name, { type: f.type })));
      const envelope = await env.seal(pt, { linkKey: op.linkKey ? b(op.linkKey) : undefined, password: op.password || undefined });
      return { envelope: s(envelope), token: op.linkKey ? await env.accessToken(b(op.linkKey)) : null };
    }
    case 'open': {
      const pt = await env.open(b(op.envelope), { linkKey: op.linkKey ? b(op.linkKey) : undefined, password: op.password || undefined });
      const p = payload.decodePayload(pt);
      return { message: p.message, files: p.files.map(f => ({ name: f.name, type: f.type, data: s(f.data) })) };
    }
    case 'keys': {
      const k = await box.generateRequestKeys();
      return { publicKey: s(k.publicKey), privateKey: s(k.privateKey), owner: await box.ownerToken(k), respond: await box.respondToken(k.publicKey) };
    }
    case 'tokens': {
      const k = { publicKey: b(op.publicKey), privateKey: b(op.privateKey) };
      return { owner: await box.ownerToken(k), respond: await box.respondToken(k.publicKey) };
    }
    case 'sealTo': {
      const pt = await payload.encodePayload(op.message, []);
      return { box: s(await box.sealTo(b(op.publicKey), pt)) };
    }
    case 'openSealed': {
      const pt = await box.openSealed({ publicKey: b(op.publicKey), privateKey: b(op.privateKey) }, b(op.box));
      return { message: payload.decodePayload(pt).message };
    }
  }
  throw new Error('op desconocida');
}

let input = '';
process.stdin.on('data', d => (input += d));
process.stdin.on('end', async () => {
  try {
    process.stdout.write(JSON.stringify(await run(JSON.parse(input))));
  } catch (e) {
    process.stdout.write(JSON.stringify({ error: String(e && e.message || e) }));
  }
});
