export async function runCollectionBatch(ids, task, { concurrency = 4 } = {}) {
  const targets = [...new Set((ids || []).map(String).filter(Boolean))];
  const results = [];
  const errors = [];
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const index = cursor++;
      const id = targets[index];
      try {
        results[index] = await task(id, index);
      } catch (error) {
        errors.push({ id, error });
      }
    }
  }

  const workerCount = Math.min(Math.max(1, Number(concurrency) || 1), targets.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return {
    total: targets.length,
    succeeded: targets.length - errors.length,
    failed: errors.length,
    results,
    errors
  };
}

