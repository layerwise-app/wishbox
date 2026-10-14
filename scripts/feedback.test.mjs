import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/d1';

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('~/')) return nextResolve(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  return nextResolve(specifier, context);
} });
const { selectPosts, slugify, validateBoardSearch, validateId, validatePost, validateSlug, validateUpdate, validateVote, validateText, initials } = await import('../src/lib/feedback.ts');
const { parseRichText, plainText, richTextToHtml, stringifyRichText } = await import('../src/lib/rich-text.ts');
const { voteInsert, commentInsert, mergeQueries } = await import('../src/lib/feedback.persistence.ts');
const { docToRichText, richTextToDoc } = await import('../src/lib/rich-text-doc.ts');
const queryBuilder = drizzle({});

const filters = { status: 'all', tag: '', search: '', sort: 'votes' };
const post = (id, changes = {}) => ({ id, title: 'An original idea', description: 'Context for a better experience', authorId: 'alice', authorName: 'Alice', status: 'open', hidden: false, mergedIntoId: null, createdAt: 100, updatedAt: 100, voteCount: 1, commentCount: 0, voted: false, tags: [], trendingScore: 1, ...changes });
const examples = [post('one', { voteCount: 5, trendingScore: 2, tags: [{ id: 'design', name: 'Design', color: 'blue' }] }), post('two', { title: 'Keyboard navigation', authorId: 'bob', createdAt: 300, status: 'planned', trendingScore: 10 }), post('three', { description: 'An accessible dark theme', voteCount: 10, createdAt: 200 })];

test('search matches titles and descriptions, ignoring case and surrounding whitespace', () => {
  assert.deepEqual(selectPosts(examples, { ...filters, search: '  KEYBOARD  ' }).map((post) => post.id), ['two']);
  assert.deepEqual(selectPosts(examples, { ...filters, search: 'dark theme' }).map((post) => post.id), ['three']);
});
test('sorting supports votes, newest, and recent trend scores without changing source data', () => {
  assert.deepEqual(selectPosts(examples, filters).map((post) => post.id), ['three', 'one', 'two']);
  assert.deepEqual(selectPosts(examples, { ...filters, sort: 'newest' }).map((post) => post.id), ['two', 'three', 'one']);
  assert.deepEqual(selectPosts(examples, { ...filters, sort: 'trending' }).map((post) => post.id), ['two', 'one', 'three']);
  assert.deepEqual(examples.map((post) => post.id), ['one', 'two', 'three']);
});
test('status, tag, and ownership filters combine correctly', () => {
  assert.deepEqual(selectPosts(examples, { ...filters, tag: 'design' }).map((post) => post.id), ['one']);
  assert.deepEqual(selectPosts(examples, { ...filters, status: 'planned' }).map((post) => post.id), ['two']);
  assert.deepEqual(selectPosts(examples, { ...filters, status: 'mine', userId: 'bob' }).map((post) => post.id), ['two']);
  assert.equal(selectPosts(examples, { ...filters, status: 'mine' }).length, 0);
  assert.equal(selectPosts(examples, { ...filters, status: 'planned', tag: 'design' }).length, 0);
});
test('shareable board filters accept only supported statuses and sort orders', () => {
  assert.deepEqual(validateBoardSearch({ q: 'dark', tag: 'design', status: 'planned', sort: 'newest' }), { q: 'dark', tag: 'design', status: 'planned', sort: 'newest' });
  assert.deepEqual(validateBoardSearch({ q: [], tag: {}, status: 'admin', sort: 'random' }), { q: undefined, tag: undefined, status: undefined, sort: undefined });
});
test('input validation trims values and rejects missing, oversized, and forged values', () => {
  assert.equal(validateText('  valid  ', 'Text', 2, 10), 'valid');
  assert.throws(() => validateId(null));
  assert.throws(() => validateId({ id: 1 }));
  assert.throws(() => validatePost({ title: 'tiny', description: 'Context for the idea' }));
  assert.throws(() => validatePost({ title: 'x'.repeat(161), description: 'Context for the idea' }));
  assert.throws(() => validatePost({ title: 'Valid title', description: 'too short' }));
  assert.throws(() => validateVote({ id: 'one', voted: 'true' }));
  assert.deepEqual(validateVote({ id: 'one', voted: false }), { id: 'one', voted: false });
  assert.equal(initials(' Alex Morgan '), 'AM');
});
test('moderation inputs reject unknown statuses, non-boolean visibility, and too many tags', () => {
  const update = { id: 'one', title: 'A valid title', description: 'A thoughtful description.', status: 'planned', hidden: false, tagIds: ['design', 'design'] };
  assert.deepEqual(validateUpdate(update).tagIds, ['design']);
  assert.throws(() => validateUpdate({ ...update, status: 'admin' }));
  assert.throws(() => validateUpdate({ ...update, hidden: 'false' }));
  assert.throws(() => validateUpdate({ ...update, tagIds: Array(11).fill('design') }));
});

test('project links are lowercase words joined by single dashes and avoid reserved names', () => {
  assert.equal(slugify('  Café Déjà Vu! '), 'cafe-deja-vu');
  assert.equal(validateSlug('acme-tasks'), 'acme-tasks');
  for (const slug of ['ab', 'Acme', 'acme--tasks', '-acme', 'acme_tasks', 'demo', 'dashboard']) assert.throws(() => validateSlug(slug));
});

const directory = new URL('../drizzle/', import.meta.url);
const migrations = readdirSync(directory).filter((folder) => existsSync(new URL(`${folder}/migration.sql`, directory))).sort();
// D1 applies each migration in a transaction with foreign keys on, where
// PRAGMA foreign_keys=OFF does nothing. Applying them the same way here
// catches migrations that would cascade-delete rows on D1.
function migrate(sqlite, folders) {
  for (const folder of folders) {
    sqlite.exec('BEGIN');
    sqlite.exec(readFileSync(new URL(`${folder}/migration.sql`, directory), 'utf8'));
    sqlite.exec('COMMIT');
  }
}
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  migrate(sqlite, migrations);
  const insertUser = sqlite.prepare('INSERT INTO user (id, name, email, created_at, updated_at) VALUES (?, ?, ?, 1, 1)');
  for (const name of ['alice', 'bob', 'admin']) insertUser.run(name, name, `${name}@test.invalid`);
  sqlite.exec("INSERT INTO project (id, slug, name, created_at) VALUES ('acme', 'acme', 'Acme', 1), ('other', 'other', 'Other', 1)");
  const insertPost = sqlite.prepare("INSERT INTO feedback (id, project_id, title, description, author_id, created_at, updated_at) VALUES (?, 'acme', ?, ?, ?, 1, 1)");
  for (const id of ['source', 'target', 'previous']) insertPost.run(id, `Idea ${id}`, 'A thoughtful description.', 'alice');
  return sqlite;
}
function execute(sqlite, query) {
  const compiled = query.toSQL();
  return sqlite.prepare(compiled.sql).run(...compiled.params);
}
function batch(sqlite, queries) {
  sqlite.exec('BEGIN');
  try { for (const query of queries) execute(sqlite, query); sqlite.exec('COMMIT'); }
  catch (error) { sqlite.exec('ROLLBACK'); throw error; }
}

test('the generated schema enforces one vote per user per post and permits different posts', () => {
  const sqlite = database();
  const insert = sqlite.prepare('INSERT INTO feedback_vote VALUES (?, ?, ?)');
  insert.run('source', 'alice', 1);
  assert.throws(() => insert.run('source', 'alice', 2), /UNIQUE/);
  insert.run('source', 'bob', 2);
  insert.run('target', 'alice', 2);
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM feedback_vote').get().total, 3);
  sqlite.close();
});
test('vote writes are idempotent and cannot write to hidden, closed, or merged ideas', () => {
  const sqlite = database();
  execute(sqlite, voteInsert(queryBuilder, 'source', 'alice', 1));
  execute(sqlite, voteInsert(queryBuilder, 'source', 'alice', 2));
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM feedback_vote').get().total, 1);
  for (const change of ["hidden = 1", "status = 'closed'", "merged_into_id = 'target'"]) {
    sqlite.exec(`UPDATE feedback SET hidden = 0, status = 'open', merged_into_id = NULL WHERE id = 'source'`);
    sqlite.exec(`UPDATE feedback SET ${change} WHERE id = 'source'`);
    assert.equal(execute(sqlite, voteInsert(queryBuilder, 'source', 'bob', 3)).changes, 0);
  }
  sqlite.close();
});
test('comment writes reject merged, hidden, closed, and nonexistent ideas at write time', () => {
  const sqlite = database();
  const input = { id: 'comment', postId: 'source', authorId: 'alice', body: 'A useful thought.', now: 1 };
  assert.equal(execute(sqlite, commentInsert(queryBuilder, input)).changes, 1);
  for (const change of ["hidden = 1", "status = 'closed'", "merged_into_id = 'target'"]) {
    sqlite.exec(`UPDATE feedback SET hidden = 0, status = 'open', merged_into_id = NULL WHERE id = 'source'`);
    sqlite.exec(`UPDATE feedback SET ${change} WHERE id = 'source'`);
    assert.equal(execute(sqlite, commentInsert(queryBuilder, { ...input, id: 'other' })).changes, 0);
  }
  assert.equal(execute(sqlite, commentInsert(queryBuilder, { ...input, id: 'missing', postId: 'missing' })).changes, 0);
  sqlite.close();
});
test('merging preserves unique votes, comments, tags, status history, and prior links', () => {
  const sqlite = database();
  sqlite.exec(`INSERT INTO feedback_vote VALUES ('source', 'alice', 1), ('source', 'bob', 2), ('target', 'alice', 3);
    INSERT INTO feedback_category VALUES ('design', 'acme', 'Design', 'blue');
    INSERT INTO feedback_tags VALUES ('source', 'design'), ('target', 'design');
    INSERT INTO feedback_comment (id, post_id, author_id, body, created_at) VALUES ('comment', 'source', 'bob', 'Worth keeping.', 2);
    INSERT INTO feedback_update VALUES ('old-update', 'source', 'admin', 'planned', 'Original update.', 2);
    UPDATE feedback SET merged_into_id = 'source' WHERE id = 'previous';`);
  batch(sqlite, mergeQueries(queryBuilder, { sourceId: 'source', targetId: 'target', authorId: 'admin', title: 'Source idea', status: 'open', now: 4, updateId: 'merge-update' }));
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM feedback_vote WHERE post_id = 'target'").get().total, 2);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM feedback_vote WHERE post_id = 'source'").get().total, 0);
  assert.equal(sqlite.prepare("SELECT post_id FROM feedback_comment WHERE id = 'comment'").get().post_id, 'target');
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM feedback_tags WHERE post_id = 'target'").get().total, 1);
  assert.equal(sqlite.prepare("SELECT count(*) AS total FROM feedback_update WHERE post_id = 'target'").get().total, 2);
  assert.equal(sqlite.prepare("SELECT updated_at FROM feedback WHERE id = 'target'").get().updated_at, 4);
  for (const id of ['source', 'previous']) assert.equal(sqlite.prepare('SELECT merged_into_id FROM feedback WHERE id = ?').get(id).merged_into_id, 'target');
  sqlite.close();
});
test('a failed merge batch rolls back transfers and original post visibility', () => {
  const sqlite = database();
  sqlite.exec("INSERT INTO feedback_vote VALUES ('source', 'alice', 1)");
  assert.throws(() => batch(sqlite, mergeQueries(queryBuilder, { sourceId: 'source', targetId: 'target', authorId: 'missing-user', title: 'Source idea', status: 'open', now: 4, updateId: 'merge-update' })), /FOREIGN KEY/);
  assert.equal(sqlite.prepare("SELECT post_id FROM feedback_vote WHERE user_id = 'alice'").get().post_id, 'source');
  assert.equal(sqlite.prepare("SELECT merged_into_id FROM feedback WHERE id = 'source'").get().merged_into_id, null);
  sqlite.close();
});
test('stale administrator merge plans cannot create cycles or merge into hidden destinations', () => {
  const sqlite = database();
  const first = { sourceId: 'source', targetId: 'target', authorId: 'admin', title: 'Source idea', status: 'open', now: 4, updateId: 'first' };
  batch(sqlite, mergeQueries(queryBuilder, first));
  assert.throws(() => batch(sqlite, mergeQueries(queryBuilder, { ...first, sourceId: 'target', targetId: 'source', updateId: 'second' })), /NOT NULL/);
  assert.equal(sqlite.prepare("SELECT merged_into_id FROM feedback WHERE id = 'target'").get().merged_into_id, null);
  sqlite.exec("UPDATE feedback SET hidden = 1 WHERE id = 'target'");
  assert.throws(() => batch(sqlite, mergeQueries(queryBuilder, { ...first, sourceId: 'previous', updateId: 'third' })), /NOT NULL/);
  assert.equal(sqlite.prepare("SELECT merged_into_id FROM feedback WHERE id = 'previous'").get().merged_into_id, null);
  sqlite.close();
});
test('ideas from different projects cannot be merged', () => {
  const sqlite = database();
  sqlite.exec("UPDATE feedback SET project_id = 'other' WHERE id = 'target'");
  assert.throws(() => batch(sqlite, mergeQueries(queryBuilder, { sourceId: 'source', targetId: 'target', authorId: 'admin', title: 'Source idea', status: 'open', now: 4, updateId: 'merge' })), /NOT NULL/);
  assert.equal(sqlite.prepare("SELECT merged_into_id FROM feedback WHERE id = 'source'").get().merged_into_id, null);
  sqlite.close();
});
test('adding projects moves an existing board into the demo project without losing its data', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  const projects = migrations.findIndex((folder) => folder.endsWith('_projects'));
  migrate(sqlite, migrations.slice(0, projects));
  sqlite.exec(`INSERT INTO user (id, name, email, created_at, updated_at, role) VALUES ('alice', 'alice', 'alice@test.invalid', 1, 1, 'admin'), ('bob', 'bob', 'bob@test.invalid', 1, 1, 'user');
    INSERT INTO feedback (id, title, description, author_id, created_at, updated_at) VALUES ('idea', 'An idea', 'A thoughtful description.', 'bob', 1, 1);
    INSERT INTO feedback_tag VALUES ('design', 'Design', 'pink');
    INSERT INTO feedback_tags VALUES ('idea', 'design');
    INSERT INTO feedback_vote VALUES ('idea', 'alice', 1);
    INSERT INTO feedback_comment (id, post_id, author_id, body, created_at) VALUES ('comment', 'idea', 'alice', 'Agreed.', 2);`);
  migrate(sqlite, migrations.slice(projects));
  const rows = (query) => sqlite.prepare(query).all().map((row) => ({ ...row }));
  assert.deepEqual(rows('SELECT id, slug FROM project'), [{ id: 'demo', slug: 'demo' }]);
  assert.deepEqual(rows('SELECT user_id, role FROM project_member'), [{ user_id: 'alice', role: 'owner' }]);
  assert.deepEqual(rows('SELECT id, project_id FROM feedback'), [{ id: 'idea', project_id: 'demo' }]);
  assert.deepEqual(rows('SELECT * FROM feedback_category'), [{ id: 'design', project_id: 'demo', name: 'Design', color: 'pink' }]);
  assert.deepEqual(rows('SELECT * FROM feedback_tags'), [{ post_id: 'idea', tag_id: 'design' }]);
  assert.equal(rows('SELECT * FROM feedback_vote').length, 1);
  assert.equal(rows('SELECT * FROM feedback_comment').length, 1);
  sqlite.close();
});
test('adding projects to an empty database creates no demo project', () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  migrate(sqlite, migrations);
  assert.equal(sqlite.prepare('SELECT count(*) AS total FROM project').get().total, 0);
  sqlite.close();
});
test('search matches the text of formatted descriptions', () => {
  assert.deepEqual(selectPosts([post('one', { description: 'An **accessible** _dark_ theme' })], { ...filters, search: 'accessible dark' }).map((post) => post.id), ['one']);
});
test('rich text survives a round trip through the editor format', () => {
  const source = '**Bold** and _italic_ with [a link](https://example.com/a%20b)\n\n- one\n- two\n\n1. first\n\n> quoted\n\n\\- not a list, snake\\_case';
  const once = stringifyRichText(parseRichText(source));
  assert.equal(stringifyRichText(parseRichText(once)), once);
  assert.equal(richTextToHtml(parseRichText(once)), '<p><strong>Bold</strong> and <em>italic</em> with <a href="https://example.com/a%20b" target="_blank" rel="noopener noreferrer nofollow">a link</a></p><ul><li>one</li><li>two</li></ul><ol><li>first</li></ol><blockquote>quoted</blockquote><p>- not a list, snake_case</p>');
  assert.equal(plainText(once), 'Bold and italic with a link one two first quoted - not a list, snake_case');
});
test('rich text escapes markup and drops unsafe links', () => {
  const html = richTextToHtml(parseRichText('<img src=x onerror=alert(1)> [x](javascript:alert(1)) [y](https://ok.com)'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('<a href="https://ok.com"'));
});
test('editor documents convert to and from stored rich text', () => {
  const source = 'Line one\nline **two [docs](https://example.com)**\n\n- one\n- _two_\n\n1. first\n\n> quoted\n> again';
  assert.equal(docToRichText(richTextToDoc(source)), source);
  const text = (value, ...marks) => ({ type: 'text', text: value, marks });
  const bold = { type: 'bold' };
  const link = (href) => ({ type: 'link', attrs: { href } });
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [text('see ', bold), text('docs', bold, link('https://x.dev')), text(' now', bold), text(' '), text('bad', link('javascript:alert(1)'))] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('a'), { type: 'hardBreak' }, text('b')] }] }, { type: 'listItem', content: [{ type: 'paragraph' }] }] },
      { type: 'paragraph' }
    ]
  };
  assert.equal(docToRichText(doc), '**see [docs](https://x.dev) now** bad\n\n- a b');
  assert.deepEqual(richTextToDoc(''), { type: 'doc', content: [{ type: 'paragraph' }] });
});
