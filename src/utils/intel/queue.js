/*
 * Convert async functions to queue
 */

const queues = {};
let interval = null;

function cleanQueues() {
  const now = Date.now();
  for (const key in queues) {
    queues[key] = queues[key].filter(([,, ts]) => !ts || ts > now);
    console.log(`Reduced queue ${key} to ${queues[key].length}`);
  }
}

/**
 * run async function with a queue and keep result around for some time,
 * Meaning that if function is already run with the same arguments, reuse it.
 * @param func async function
 * @return new async function
 */
export function queueWithDelay(func, gracePeriod = 5000) {
  const queue = [];
  queues[func.name] = queue;
  if (!interval) {
    interval = setInterval(cleanQueues, 5000);
  }

  return (...args) => {
    const ident = args.join('-');
    const runReq = queue.find((q) => q[0] === ident);
    if (runReq) {
      return runReq[1];
    }
    let queueObject;
    const promise = new Promise((res, rej) => {
      func(...args).then(res).catch(rej).finally(() => {
        queueObject.push(Date.now() + gracePeriod);
      });
    });
    queueObject = [ident, promise];
    queue.push(queueObject);
    return promise;
  };
}

/**
 * run async function with a queue.
 * Meaning that if function is already run with the same arguments, reuse it.
 * @param func async function
 * @return new async function
 */
export function queue(func) {
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
