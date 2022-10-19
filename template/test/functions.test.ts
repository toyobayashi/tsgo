import { add } from '../src/add'

describe('functions', function () {
  test('1 + 2 === 3', () => {
    expect(add(1, 2)).toBe(3)
  })
})
