function createChallenge(randomInt, randomStr, compileWat) {
  const solution = randomInt(0xFFFFFFFF);
  // eslint-disable-next-line max-len
  const wat = `(module (func (export "run") (result i32) i32.const ${solution}))`;
  const buffer = compileWat(wat);

  const data = `w = new Uint8Array([${buffer.toString()}]);
  WebAssembly.instantiate(w).then(wasmModule => {
    postMessage(wasmModule.instance.exports.run());
  });`;

  return {
    solution,
    data,
  };
}

module.exports = createChallenge;
