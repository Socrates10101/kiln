#!/usr/bin/env tsx

const command = process.argv[2];

if (command === 'install') {
  const { install } = await import('./install.js');
  console.log('Installing Kiln skills...');
  await install(process.cwd());
  process.exit(0);
}

// Default: start the server
const { loadConfig } = await import('./config/loader.js');
const { EventBus } = await import('./events/event-bus.js');
const { VariantManifest } = await import('./stores/variant-manifest.js');
const { ReviewStore } = await import('./stores/review-store.js');
const { AgentOracle } = await import('./agents/oracle.js');
const { createServer } = await import('./server/create-server.js');

async function main() {
  const root = process.cwd();

  // 1. Load config
  console.log('Loading kiln.config...');
  const config = await loadConfig(root);

  // 2. Initialize EventBus
  const bus = new EventBus();

  // 3. Initialize VariantManifest (fs scan + watch)
  console.log('Scanning variant files...');
  const manifest = new VariantManifest({
    root: config.root,
    include: config.variants.include,
    pattern: config.variants.pattern,
    bus,
  });
  manifest.start();

  const components = manifest.getComponents();
  const variantCount = components.reduce((sum, c) => sum + c.variants.size, 0);
  console.log(`Found ${components.length} components, ${variantCount} variants`);

  // 4. Initialize ReviewStore
  const reviewStore = new ReviewStore({
    root: config.root,
    file: config.review.file,
  });

  // 5. Initialize AgentOracle
  const oracle = new AgentOracle({
    root: config.root,
    stateDir: config.agents.stateDir,
    pollInterval: config.agents.pollInterval,
    bus,
  });
  oracle.start();

  // 6. Create and start server
  console.log('Starting server...');
  const server = await createServer({ config, bus, manifest, reviewStore, oracle });
  await server.listen();

  console.log('');
  console.log(`  Kiln is running at http://localhost:${config.server.port}`);
  console.log('');
  console.log(`  Dashboard:  http://localhost:${config.server.port}/`);
  console.log(`  API:        http://localhost:${config.server.port}/api/manifest`);
  console.log(`  Events:     http://localhost:${config.server.port}/api/events`);
  console.log('');

  bus.emit({ type: 'system:ready' });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nShutting down...');
    manifest.stop();
    oracle.stop();
    bus.removeAllListeners();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Failed to start Kiln:', err.message);
  process.exit(1);
});
