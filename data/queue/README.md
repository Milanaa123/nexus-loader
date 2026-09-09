# Persistent queue

Runtime queue JSON is created automatically by `lib/job-queue.js` and is ignored by Git. Corrupt queue files are preserved with a `.broken-*` suffix before recovery.
