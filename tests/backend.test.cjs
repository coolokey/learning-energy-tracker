const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const JPEG = Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF]), Buffer.from('JPEG content test')]).toString('base64');
const PNG = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('PNG badge')]).toString('base64');

function noteReply(scores = { focus: 90, depth: 88, structure: 92, insight: 86, presentation: 94 }) {
  return {
    kind: 'note', topic: '顯微鏡植物細胞觀察', keywords: '細胞核, 葉綠體, 保衛細胞',
    summary: '細心記錄細胞結構圖與放大倍率分析。', feedback: '觀察非常敏銳，作圖詳實！',
    advice: '換一種植物比較看看。', sdgs: 'SDG 15 陸地生態', noteScores: scores
  };
}

function artReply(over = {}) {
  return {
    kind: 'art', topic: '星界守護者', summary: '奇幻守護者半身像', feedback: '光影氛圍強烈。', advice: '背景降低彩度。',
    artScores: { themeScore: 95, compScore: 90, colorScore: 88, lightScore: 86, detailScore: 90 },
    focusX: 0.5, focusY: 0.4, palette: ['#173e35', '#24654d', 'not-a-color', '#d97706'], totalScore: 12, ...over
  };
}

function makeSheet(name) {
  const rows = [];
  const colWidths = {};
  return {
    rows,
    colWidths,
    getName: () => name,
    setName: () => {},
    appendRow: row => rows.push([...row]),
    setFrozenRows: () => {},
    setColumnWidth: (col, w) => { colWidths[col] = w; },
    getLastRow: () => rows.length,
    getRange: (r, c, numRows) => {
      if (typeof r === 'string' || numRows !== undefined) {
        const chain = {
          setBackground: () => chain,
          setFontColor: () => chain,
          setFontWeight: () => chain,
          setVerticalAlignment: () => chain
        };
        return chain;
      }
      return { setValue: v => { while (rows[r - 1].length < c) rows[r - 1].push(''); rows[r - 1][c - 1] = v; } };
    },
    getDataRange: () => ({ getValues: () => rows.map(r => [...r]) })
  };
}

function setup(overrides = {}, geminiReply = noteReply()) {
  const props = {
    FOLDER_ID: 'root_folder_id',
    ASSIGNMENTS: '自主學習探究,藝術創作挑戰',
    DAILY_LIMIT: '200',
    ADMIN_PASSWORD: 'admin888',
    GEMINI_API_KEY: 'test-gemini-key',
    ...overrides
  };

  const files = [];
  function createMockFolder(name) {
    const children = new Map();
    return {
      getName: () => name,
      getFoldersByName: n => { const f = children.get(n); return { hasNext: () => !!f, next: () => f }; },
      createFolder: n => { const f = createMockFolder(n); children.set(n, f); return f; },
      getFilesByName: n => { const found = files.find(f => f.name === n); return { hasNext: () => !!found, next: () => found }; },
      createFile: b => {
        const id = 'file-' + files.length;
        const f = {
          name: b.name, bytes: b.bytes, getId: () => id, getName: () => b.name, setDescription: () => {},
          getUrl: () => 'https://drive.google.com/file/' + b.name,
          getBlob: () => ({ getBytes: () => b.bytes })
        };
        files.push(f);
        return f;
      },
      addFile: () => {}
    };
  }
  const root = createMockFolder('root_folder_id');

  const sheets = { '能量軌跡總表': makeSheet('能量軌跡總表') };
  let firstSheetCreated = false;
  const mockSpreadsheet = {
    getId: () => 'sheet-123',
    getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-123',
    getActiveSheet: () => sheets['能量軌跡總表'],
    getSheetByName: n => sheets[n] || null,
    insertSheet: n => (sheets[n] = makeSheet(n))
  };

  const docParagraphs = [];
  const docImages = [];
  let pageBreaks = 0;
  const para = text => {
    const p = { text, setHeading: () => p, setAlignment: () => p, setFontSize: () => p, setForegroundColor: () => p, setLineSpacing: () => p };
    docParagraphs.push(p);
    return p;
  };
  const mockDocBody = {
    setMarginTop() { return this; }, setMarginBottom() { return this; },
    setMarginLeft() { return this; }, setMarginRight() { return this; },
    appendParagraph: para,
    appendHorizontalRule: () => {},
    appendPageBreak: () => { pageBreaks++; },
    appendImage: blob => { docImages.push(blob); const img = { setWidth: () => img, setHeight: () => img }; return img; }
  };

  const urlFetchCalls = [];
  let reply = geminiReply;
  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = String(v); } }) },
    DriveApp: {
      getFolderById: () => root,
      getFileById: id => files.find(f => f.getId() === id) || { getId: () => id },
      getRootFolder: () => ({ removeFile: () => {} })
    },
    SpreadsheetApp: {
      openById: () => mockSpreadsheet,
      create: () => {
        if (!firstSheetCreated) { firstSheetCreated = true; }
        return mockSpreadsheet;
      }
    },
    DocumentApp: {
      create: () => ({ getId: () => 'doc-123', getUrl: () => 'https://docs.google.com/document/d/doc-123', getBody: () => mockDocBody, saveAndClose: () => {} }),
      ParagraphHeading: { HEADING1: 1, HEADING2: 2, HEADING3: 3 },
      HorizontalAlignment: { CENTER: 1 }
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: {
      base64Decode: s => [...Buffer.from(s, 'base64')],
      base64Encode: b => Buffer.from(b).toString('base64'),
      newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
      formatDate: () => '2026/10/19 18:30:00'
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: content => ({ setMimeType: mime => ({ getContent: () => content, getMimeType: () => mime }) })
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        urlFetchCalls.push({ url, opts });
        if (!url.includes(':generateContent')) {
          return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] }) };
        }
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] })
        };
      }
    },
    HtmlService: {
      XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
      createHtmlOutputFromFile: () => ({ setTitle() { return this; }, addMetaTag() { return this; }, setXFrameOptionsMode() { return this; } })
    }
  });

  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), ctx);

  const sampleData = {
    anonymousDocumentConsent: true,
    className: '702',
    seat: '5',
    name: '李小花',
    assignment: '自主學習探究',
    requestId: '11111111-2222-4333-8444-555555555555',
    mimeType: 'image/jpeg',
    fileData: JPEG
  };
  const mainRows = () => sheets['能量軌跡總表'].rows;
  return { ctx, sampleData, files, props, sheets, mainRows, docParagraphs, docImages, urlFetchCalls, pageBreaks: () => pageBreaks, setReply: r => { reply = r; } };
}

const uuid = n => `11111111-2222-4333-8444-${String(n).padStart(12, '0')}`;

// ---------------- 基本服務 ----------------
test('serves the student HTML page and public config', () => {
  const s = setup();
  assert.ok(s.ctx.doGet());
  const cfg = s.ctx.getPublicConfig();
  assert.equal(cfg.ready, true);
  assert.equal(cfg.aiEnabled, true);
  assert.equal(cfg.badgeApproval, 'auto');
  assert.equal(cfg.badgeThreshold, 85);
  assert.deepEqual([...cfg.assignments], ['自主學習探究', '藝術創作挑戰']);
});

test('not ready when FOLDER_ID is missing', () => {
  const s = setup({ FOLDER_ID: '' });
  assert.equal(s.ctx.getPublicConfig().ready, false);
  assert.throws(() => s.ctx.uploadSubmission(s.sampleData), /資料夾/);
});

// ---------------- 收件防護 ----------------
test('rejects spoofed file signatures, bad seat and unknown assignment', () => {
  const s = setup();
  const fake = Buffer.from('not really a jpeg').toString('base64');
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, fileData: fake }), /格式不符/);
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, seat: '100' }), /座號/);
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, assignment: '不存在' }), /作業項目/);
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, requestId: 'abc' }), /識別/);
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, name: '<script>' }), /姓名/);
});

test('rejects files over 10 MB', () => {
  const s = setup();
  const big = 'A'.repeat(4 * Math.ceil((10 * 1024 * 1024 + 10) / 3));
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, fileData: big }), /10 MB/);
});

test('enforces the daily limit', () => {
  const s = setup({ DAILY_LIMIT: '1' });
  s.ctx.uploadSubmission(s.sampleData);
  assert.throws(() => s.ctx.uploadSubmission({ ...s.sampleData, requestId: uuid(2) }), /上限/);
});

// ---------------- AI 分析 ----------------
test('note submission: classified, scored server-side and recorded', () => {
  const s = setup();
  const res = s.ctx.uploadSubmission(s.sampleData);
  assert.equal(res.ai.kind, 'note');
  assert.equal(res.ai.score, 90); // (90+88+92+86+94)/5
  assert.equal(res.badge, '可製作');
  assert.equal(res.ai.tag, 'SDG 15 陸地生態');
  const row = s.mainRows().at(-1);
  assert.equal(row[1], '702');
  assert.equal(row[2], '05');
  assert.equal(row[5], '探究筆記');
  assert.equal(row[14], 90);
  assert.equal(row[16], s.sampleData.requestId);
  assert.equal(row[18], '可製作');
});

test('art submission: weighted score ignores model total and filters bad palette colors', () => {
  const s = setup({}, artReply());
  const res = s.ctx.uploadSubmission({ ...s.sampleData, artTheme: '奇幻生物與幻獸', studentNote: '我在畫星界守護者' });
  assert.equal(res.ai.kind, 'art');
  // 95*.35 + 90*.2 + 88*.15 + 86*.15 + 90*.15 = 33.25+18+13.2+12.9+13.5 = 90.85
  assert.equal(res.ai.score, 91);
  assert.deepEqual([...res.ai.palette], ['#173e35', '#24654d', '#d97706']);
  assert.equal(res.ai.tag, '奇幻生物與幻獸');
  const prompt = JSON.parse(s.urlFetchCalls.find(c => c.url.includes(':generateContent')).opts.payload).contents[0].parts[0].text;
  assert.match(prompt, /奇幻生物與幻獸/);
  assert.match(prompt, /我在畫星界守護者/);
});

test('invalid submission is capped at 30 and never badge-eligible', () => {
  const s = setup({}, { kind: 'invalid', topic: '無法評鑑', summary: '空白紙', feedback: '請重新上傳', advice: '確認入鏡',
    noteScores: { focus: 80, depth: 90, structure: 20, insight: 15, presentation: 25 } });
  const res = s.ctx.uploadSubmission(s.sampleData);
  assert.equal(res.ai.kind, 'invalid');
  assert.ok(res.ai.score <= 30);
  assert.equal(res.badge, '未達標');
});

test('missing scores are never fabricated', () => {
  const s = setup({}, { kind: 'note', topic: '主題', summary: '摘要', feedback: '評語', advice: '建議', noteScores: { focus: 90 } });
  const res = s.ctx.uploadSubmission(s.sampleData);
  assert.equal(res.ai.dims, null);
  assert.equal(res.ai.score, null);
  assert.equal(res.badge, '未達標');
});

test('AI requires consent and an API key; collection still works without them', () => {
  const s = setup();
  const r1 = s.ctx.uploadSubmission({ ...s.sampleData, anonymousDocumentConsent: false });
  assert.equal(r1.success, true);
  assert.equal(r1.ai.kind, 'unavailable');
  assert.equal(s.urlFetchCalls.length, 0);

  const s2 = setup({ GEMINI_API_KEY: '' });
  const r2 = s2.ctx.uploadSubmission(s2.sampleData);
  assert.equal(r2.ai.score, null);
  assert.equal(s2.urlFetchCalls.length, 0);
  assert.equal(s2.mainRows().at(-1)[5], '未分析');
});

test('AI prompt never contains student identity', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  const prompt = JSON.parse(s.urlFetchCalls.find(c => c.url.includes(':generateContent')).opts.payload).contents[0].parts[0].text;
  assert.doesNotMatch(prompt, /李小花|702|座號|姓名/);
});

test('duplicate requestId returns the original record instead of re-analysing', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  const calls = s.urlFetchCalls.length;
  const again = s.ctx.uploadSubmission(s.sampleData);
  assert.equal(again.duplicate, true);
  assert.equal(again.ai.score, 90);
  assert.equal(s.urlFetchCalls.length, calls);
  assert.equal(s.mainRows().length, 2); // header + 1
});

// ---------------- 胸章 ----------------
test('badge: auto mode issues immediately and writes to gallery with masked name', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  const res = s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: 'data:image/png;base64,' + PNG, thumbBase64: JPEG });
  assert.equal(res.status, '已發放');
  assert.equal(s.mainRows().at(-1)[18], '已發放');
  assert.ok(s.mainRows().at(-1)[21]);
  const gallery = s.ctx.getGallery();
  assert.equal(gallery.list.length, 1);
  assert.equal(gallery.list[0].name, '李○花');
});

test('badge: server rejects low scores, unknown receipts and non-PNG images', () => {
  const s = setup({}, noteReply({ focus: 70, depth: 70, structure: 70, insight: 70, presentation: 70 }));
  s.ctx.uploadSubmission(s.sampleData);
  assert.throws(() => s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: PNG }), /85/);
  assert.throws(() => s.ctx.saveBadge({ receipt: uuid(99), imageBase64: PNG }), /找不到/);
  assert.throws(() => s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: JPEG }), /格式不符/);
});

test('badge: teacher mode waits for approval; reject hides it from gallery', () => {
  const s = setup({ BADGE_APPROVAL: 'teacher' });
  s.ctx.uploadSubmission(s.sampleData);
  const res = s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: PNG, thumbBase64: JPEG });
  assert.equal(res.status, '待審核');
  assert.equal(s.ctx.getGallery().list.length, 0);
  assert.throws(() => s.ctx.getBadgeImage({ receipt: s.sampleData.requestId }), /尚未發放/);

  s.ctx.reviewSubmission({ password: 'admin888', receipt: s.sampleData.requestId, badgeDecision: 'approve', teacherComment: '很棒的觀察！' });
  assert.equal(s.mainRows().at(-1)[18], '已發放');
  assert.equal(s.mainRows().at(-1)[20], '很棒的觀察！');
  assert.equal(s.ctx.getGallery().list.length, 1);
  assert.ok(s.ctx.getBadgeImage({ receipt: s.sampleData.requestId }).imageBase64);

  s.ctx.reviewSubmission({ password: 'admin888', receipt: s.sampleData.requestId, badgeDecision: 'reject' });
  assert.equal(s.ctx.getGallery().list.length, 0);
  assert.throws(() => s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: PNG }), /駁回/);
});

test('gallery can be turned off by the teacher', () => {
  const s = setup();
  s.ctx.updateSettings({ password: 'admin888', galleryPublic: false, badgeApproval: 'teacher' });
  assert.equal(s.ctx.getGallery().enabled, false);
  assert.equal(s.ctx.getPublicConfig().badgeApproval, 'teacher');
  assert.throws(() => s.ctx.updateSettings({ password: 'admin888', badgeApproval: 'whatever' }), /auto 或 teacher/);
});

// ---------------- 能量軌跡 ----------------
test('trajectory: a receipt unlocks only that student\'s own records, in time order', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  s.ctx.uploadSubmission({ ...s.sampleData, requestId: uuid(2), seat: '05' });
  s.ctx.uploadSubmission({ ...s.sampleData, requestId: uuid(3), name: '別人' });
  const t = s.ctx.getStudentTrajectory({ receipt: uuid(2) });
  assert.equal(t.found, true);
  assert.equal(t.list.length, 2);
  assert.ok(t.list.every(r => r.name === '李小花'));
  assert.equal(t.stats.total, 2);
  assert.equal(t.stats.average, 90);
});

test('trajectory: identity-only lookups are rejected; wrong receipts return nothing', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  assert.throws(() => s.ctx.getStudentTrajectory({ className: '702', name: '李小花' }), /收據/);
  const t = s.ctx.getStudentTrajectory({ receipt: uuid(77) });
  assert.equal(t.found, false);
  assert.equal(t.list.length, 0);
});

test('seeded demo data contains a multi-step growth trajectory', () => {
  const s = setup();
  const res = s.ctx.seedDemoSubmissions({ password: 'admin888' });
  assert.equal(res.count, 6);
  const t = s.ctx.getStudentTrajectory({ receipt: res.demoReceipt });
  assert.equal(t.list.length, 3);
  assert.equal(t.stats.growth, 18);
  assert.equal(t.stats.arts, 1);
  assert.equal(t.stats.badges, 1);
});

// ---------------- 教師後台 ----------------
test('admin password checks, including unconfigured password', () => {
  const s = setup();
  assert.equal(s.ctx.verifyAdmin('admin888').success, true);
  assert.throws(() => s.ctx.verifyAdmin('wrong'), /密碼不正確/);
  assert.throws(() => s.ctx.getAdminOverview({ password: 'wrong' }), /密碼不正確/);
  const s2 = setup({ ADMIN_PASSWORD: '' });
  assert.throws(() => s2.ctx.verifyAdmin('admin888'), /管理密碼/);
});

test('admin manages assignments, API key and password', () => {
  const s = setup();
  const r = s.ctx.updateAssignments({ password: 'admin888', assignments: ['自然探究', '美術單元'] });
  assert.deepEqual([...r.assignments], ['自然探究', '美術單元']);
  assert.throws(() => s.ctx.updateAssignments({ password: 'admin888', assignments: [] }), /至少/);
  const k = s.ctx.setGeminiApiKey({ password: 'admin888', apiKey: 'new-key' });
  assert.equal(k.hasAi, true);
  assert.equal(s.props.GEMINI_API_KEY, 'new-key');
  s.ctx.changeAdminPassword({ oldPassword: 'admin888', newPassword: 'newpass' });
  assert.equal(s.ctx.verifyAdmin('newpass').success, true);
});

test('admin overview lists records and counts pending badges', () => {
  const s = setup({ BADGE_APPROVAL: 'teacher' });
  s.ctx.uploadSubmission(s.sampleData);
  s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: PNG });
  const o = s.ctx.getAdminOverview({ password: 'admin888' });
  assert.equal(o.submissions.length, 1);
  assert.equal(o.pendingBadges, 1);
  assert.equal(o.badgeApproval, 'teacher');
});

test('spreadsheet values are protected against formula injection', () => {
  const s = setup({}, { ...noteReply(), topic: '=HYPERLINK("x")' });
  s.ctx.uploadSubmission(s.sampleData);
  assert.equal(s.mainRows().at(-1)[8], '\'=HYPERLINK("x")');
});

test('exportSummaryDoc groups by student with page breaks and badge images', () => {
  const s = setup();
  s.ctx.uploadSubmission(s.sampleData);
  s.ctx.saveBadge({ receipt: s.sampleData.requestId, imageBase64: PNG });
  s.ctx.uploadSubmission({ ...s.sampleData, requestId: uuid(5), name: '陳同學' });
  const res = s.ctx.exportSummaryDoc({ password: 'admin888', className: '702' });
  assert.ok(res.docUrl.includes('docs.google.com/document'));
  assert.equal(s.pageBreaks(), 1);
  assert.equal(s.docImages.length, 1);
  assert.ok(s.docParagraphs.some(p => /能量軌跡：共 1 件/.test(p.text)));
  assert.throws(() => s.ctx.exportSummaryDoc({ password: 'admin888', className: '999' }), /未找到/);
});

test('spreadsheet settings sheet stores and reads GEMINI_API_KEY and settings directly', () => {
  const s = setup({ GEMINI_API_KEY: '' });
  assert.equal(s.ctx.getPublicConfig().aiEnabled, false);

  // Teacher pastes GEMINI_API_KEY directly into cell B2 of '系統設定' sheet
  const setSheet = s.sheets['系統設定'];
  assert.ok(setSheet, '系統設定 sheet should be auto-created');
  const keyRowIdx = setSheet.rows.findIndex(r => r[0] === 'GEMINI_API_KEY');
  assert.ok(keyRowIdx >= 1, 'GEMINI_API_KEY row should exist');
  setSheet.rows[keyRowIdx][1] = 'sheet-stored-api-key-999';

  // Backend immediately picks up the key from the spreadsheet even when ScriptProperties is empty
  assert.equal(s.ctx.getPublicConfig().aiEnabled, true);
  const res = s.ctx.uploadSubmission(s.sampleData);
  assert.equal(res.ai.kind, 'note');
  assert.equal(res.ai.score, 90);
  assert.ok(s.urlFetchCalls.some(c => c.url.includes('sheet-stored-api-key-999')));

  // Setting API key via Admin UI also syncs back to the spreadsheet
  s.ctx.setGeminiApiKey({ password: 'admin888', apiKey: 'updated-from-ui-key' });
  assert.equal(setSheet.rows[keyRowIdx][1], 'updated-from-ui-key');

  // Verify column widths are automatically formatted across all sheets
  const fmt = s.ctx.formatAllSheets({ password: 'admin888' });
  assert.equal(fmt.success, true);
  assert.equal(Object.keys(s.sheets['能量軌跡總表'].colWidths).length, 22);
  assert.equal(Object.keys(s.sheets['系統設定'].colWidths).length, 3);
  assert.equal(Object.keys(s.sheets['星空藝廊'].colWidths).length, 9);
});

test('doPost routes actions and reports errors as JSON', () => {
  const s = setup();
  const ok = JSON.parse(s.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'getPublicConfig' }) } }).getContent());
  assert.equal(ok.success, true);
  assert.equal(ok.data.ready, true);
  const bad = JSON.parse(s.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'verifyAdmin', data: { password: 'x' } }) } }).getContent());
  assert.equal(bad.success, false);
  assert.match(bad.error, /密碼不正確/);
  const unknown = JSON.parse(s.ctx.doPost({ postData: { contents: JSON.stringify({ action: 'deleteEverything' }) } }).getContent());
  assert.equal(unknown.success, false);
});
