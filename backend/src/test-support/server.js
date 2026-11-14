import { once } from 'node:events';

export async function startTestServer(application) {
  if (typeof application?.listen !== 'function') {
    throw new TypeError('startTestServer requires an Express application.');
  }

  const server = application.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();

  if (!address || typeof address === 'string') {
    await closeServer(server);
    throw new Error('Test server did not expose a TCP address.');
  }

  let closePromise;

  return Object.freeze({
    baseUrl: `http://127.0.0.1:${address.port}`,
    close() {
      closePromise ??= closeServer(server);
      return closePromise;
    },
  });
}

export async function withTestServer(application, operation) {
  const testServer = await startTestServer(application);

  try {
    return await operation(testServer);
  } finally {
    await testServer.close();
  }
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
