// Register before other app modules so capture-phase listeners run first and the
// CRA/react dev overlay does not treat this benign Chrome quirk as a runtime error.
// See: https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
const isResizeObserverNoise = (event) => {
  const msg = String(
    event?.message ||
      event?.error?.message ||
      (event?.error && String(event.error)) ||
      ''
  );
  return /ResizeObserver loop/i.test(msg);
};

const onError = (event) => {
  if (isResizeObserverNoise(event)) {
    event.stopImmediatePropagation();
    event.preventDefault();
  }
};

window.addEventListener('error', onError, true);
