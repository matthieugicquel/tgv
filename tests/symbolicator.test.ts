import type { RawFrame } from '../src/dev-server/symbolicator/types.js';

it('symbolicates a frame', () => {
  const frame: RawFrame = {
    file: 'http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false&modulesOnly=false&runModule=true&app=com.tgv',
    methodName: 'Root',
    arguments: [],
    lineNumber: 592060,
    column: 52,
  };

  expect(frame).toMatchInlineSnapshot(`
    Object {
      "arguments": Array [],
      "column": 52,
      "file": "http://localhost:8081/index.bundle?platform=ios&dev=true&minify=false&modulesOnly=false&runModule=true&app=com.tgv",
      "lineNumber": 592060,
      "methodName": "Root",
    }
  `);
});
