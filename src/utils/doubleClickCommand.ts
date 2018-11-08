export function createDoubleClickCommand(callback: (...args: any[]) => any) {
  let lastTime: Date | undefined;

  return function(...args: any[]) {
    if (lastTime !== undefined) {
      let dateDiff = new Date().getTime() - lastTime.getTime();
      if (dateDiff < 500) {
        lastTime = undefined;
        callback(args);
        return;
      }
    }

    lastTime = new Date();
  };
}
