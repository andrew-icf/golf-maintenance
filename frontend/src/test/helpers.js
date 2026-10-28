// A promise whose outcome the test decides, to hold a request in flight and then finish it
export function createDeferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}