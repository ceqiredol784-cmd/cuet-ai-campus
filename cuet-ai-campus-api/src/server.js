import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import app from './app.js';

const start = async () => {
  try {
    await connectDB();

    // Auto-seed only an empty database: re-seeding on every restart would
    // duplicate the demo content (or fail on the first duplicate account).
    if (env.autoSeed) {
      const { User } = await import('./models/index.js');
      if ((await User.countDocuments({})) === 0) {
        const { seedDatabase } = await import('./seed/seed.js');
        try {
          await seedDatabase({ clear: false });
          console.log('[seed] Initial database seeded successfully');
        } catch (error) {
          console.error('[seed] auto-seed skipped:', error.message);
        }
      }
    }

    app.listen(env.port, () => {
      console.log(`[api] CUET AI Campus API listening on http://localhost:${env.port}`);
      console.log(`[api] Environment: ${env.nodeEnv}`);
      console.log(`[api] MongoDB: ${env.mongoUri}`);
    });
  } catch (error) {
    console.error('[api] failed to start:', error);
    process.exit(1);
  }
};

start();
