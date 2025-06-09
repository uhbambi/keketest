/*
 * Convert async functions to queue
 */

/**
 * run async function with a queue and keep result around for some time.
 * Meaning that if function is already run with the same arguments, reuse it.
 * @param func async function
 * @param gracePeriod period the result should be cached
 * @return new async function
 */
export function queue(func, gracePeriod = 5000) {
  let queue = [];
  let lastCleanTs = 0;

  return (...args) => {
    const ident = args.join('-');
    const currentTs = Date.now();
    /* clean outdated requests */
    if (lastCleanTs < currentTs - gracePeriod) {
      queue = queue.filter(([,, ts]) => !ts || ts > currentTs);
      console.log(`Reduced queue ${func.name} to ${queue.length}`);
      lastCleanTs = currentTs;
    }
    /* try to find equal request */
    const runReq = queue.find((q) => q[0] === ident);
    if (runReq) {
      return runReq[1];
    }
    /* queue new request */
    let queueObject = [ident];
    const promise = new Promise((res, rej) => {
      func(...args).then(res).catch(rej).finally(() => {
        queueObject.push(Date.now() + gracePeriod);
      });
    });
    /*
     * Pushing the promise will happen before the finally() can push the
     * timestamp, even if the async function returns instantly.
     * However, i did not find any confirmation of this in specs yet, so we
     * check for queueObject.length and don't queue if it already returned.
     */
    if (queueObject.length === 1) {
      queueObject.push(promise);
      queue.push(queueObject);
    }
    return promise;
  };
}

/**
 * run async function with a queue.
 * Meaning that if function is already run with the same arguments, reuse it.
 * @param func async function
 * @return new async function
 */
export function queueWithoutGracePeriod(func) {
  const queue = [];

  return (...args) => {
    const ident = args.join('-');
    const runReq = queue.find((q) => q[0] === ident);
    if (runReq) {
      return runReq[1];
    }
    const promise = new Promise((res, rej) => {
      func(...args).then(res).catch(rej).finally(() => {
        queue.splice(queue.findIndex((q) => q[0] === ident), 1);
      });
    });
    queue.push([ident, promise]);
    return promise;
  };
}

export default queue;
