/** Exercise each collection's read recovery and complete-array write boundary. */
import { describe, it, expect, vi } from 'vitest';
import { getPosts, savePosts, getUsers, saveUsers } from './storage.js';
for (const [key, read, save] of [
  ['writespace_posts', getPosts, savePosts],
  ['writespace_users', getUsers, saveUsers],
]) {
  describe(key, () => {
    it('returns empty when absent without creating a key', () => {
      expect(read()).toEqual([]);
      expect(localStorage.getItem(key)).toBeNull();
    });
    it.each(['{broken', '{}', 'null', '"text"', '42', 'true'])(
      'recovers safely from %s without rewriting it',
      (raw) => {
        localStorage.setItem(key, raw);
        expect(read()).toEqual([]);
        expect(localStorage.getItem(key)).toBe(raw);
      },
    );
    it('recovers from throwing storage reads', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied');
      });
      expect(read()).toEqual([]);
    });
    it('round trips populated and empty collections and leaves unrelated keys intact', () => {
      const rows = [
        { id: 'demo', content: '<script>plain text</script>' },
        null,
      ];
      localStorage.setItem('unrelated', 'keep');
      save(rows);
      expect(read()).toEqual(rows);
      expect(localStorage.getItem(key)).toBe(JSON.stringify(rows));
      save([]);
      expect(read()).toEqual([]);
      expect(localStorage.getItem('unrelated')).toBe('keep');
    });
    it('propagates write failure and preserves old storage', () => {
      save([{ id: 'old' }]);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      expect(() => save([{ id: 'new' }])).toThrow('quota');
      expect(read()).toEqual([{ id: 'old' }]);
    });
    it('propagates serialization failure without changing persisted rows', () => {
      save([{ id: 'old' }]);
      const circular = [];
      circular.push(circular);
      expect(() => save(circular)).toThrow();
      expect(read()).toEqual([{ id: 'old' }]);
    });
  });
}
