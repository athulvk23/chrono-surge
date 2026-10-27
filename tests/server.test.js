/* =========================================================================
   CHRONO SURGE: BEGINNING - SERVER & API INTEGRATION TESTS
   Uses Node.js built-in test runner (node:test, node:assert)
   ========================================================================= */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

// Spin up a test server instance on an isolated port
const PORT = 3982;
let serverInstance;

function makeRequest(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json || data
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

test.before(async () => {
  // Set test database path to avoid overriding production data
  process.env.PORT = String(PORT);
  process.env.DB_PATH = path.join(__dirname, 'test_db.json');
  if (fs.existsSync(process.env.DB_PATH)) {
    try { fs.unlinkSync(process.env.DB_PATH); } catch {}
  }
  
  // Require and start the server
  const serverModule = require('../server.js');
  serverInstance = serverModule.startServer(PORT);
  // Give server time to bind if needed
  await new Promise(r => setTimeout(r, 200));
});

test.after(async () => {
  if (serverInstance && serverInstance.close) {
    await new Promise(r => serverInstance.close(r));
  }
  if (process.env.DB_PATH && fs.existsSync(process.env.DB_PATH)) {
    try { fs.unlinkSync(process.env.DB_PATH); } catch {}
  }
});

test('Health Check API returns ok status', async () => {
  const res = await makeRequest('GET', '/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.ok(res.body.timestamp);
});

test('Daily Challenge API generates deterministic seed & modifiers', async () => {
  const res = await makeRequest('GET', '/api/daily');
  assert.equal(res.status, 200);
  assert.ok(res.body.seed > 0, 'Seed must be a positive integer');
  assert.ok(res.body.date, 'Date must be provided');
  assert.ok(res.body.modifier, 'Modifier must be defined');
  assert.ok(res.body.modifier.name);
});

test('Leaderboard API returns structured rankings', async () => {
  const res = await makeRequest('GET', '/api/leaderboard?mode=endless');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.entries));
  assert.equal(typeof res.body.total, 'number');
});

test('Authentication: Registration & Login flow', async () => {
  const testUser = `pilot_${Date.now().toString(36)}`;
  const testPass = 'HyperSlash2026!';

  // 1. Register new user
  const regRes = await makeRequest('POST', '/api/auth/register', {}, {
    username: testUser,
    password: testPass,
    displayName: 'VALKYRIE-ALPHA'
  });
  assert.equal(regRes.status, 201);
  assert.ok(regRes.body.token, 'Token must be returned on register');
  assert.equal(regRes.body.user.username, testUser);

  const authToken = regRes.body.token;

  // 2. Prevent duplicate registration
  const dupRes = await makeRequest('POST', '/api/auth/register', {}, {
    username: testUser,
    password: testPass
  });
  assert.equal(dupRes.status, 409);

  // 3. Login with correct password
  const loginRes = await makeRequest('POST', '/api/auth/login', {}, {
    username: testUser,
    password: testPass
  });
  assert.equal(loginRes.status, 200);
  assert.ok(loginRes.body.token);

  // 4. Reject invalid password
  const badLogin = await makeRequest('POST', '/api/auth/login', {}, {
    username: testUser,
    password: 'WrongPassword'
  });
  assert.equal(badLogin.status, 401);

  // 5. Cloud Profile Sync (isolated to authenticated user)
  const syncRes = await makeRequest('PUT', '/api/profile/sync', {
    'Authorization': `Bearer ${authToken}`
  }, {
    profile: {
      displayName: 'VALKYRIE-PRIME',
      shards: 1250,
      level: 4,
      highestWave: 12,
      bestScore: 84000
    }
  });
  assert.equal(syncRes.status, 200);
  assert.equal(syncRes.body.ok, true);

  // 6. Fetch Synced Profile
  const getProfileRes = await makeRequest('GET', '/api/profile', {
    'Authorization': `Bearer ${authToken}`
  });
  assert.equal(getProfileRes.status, 200);
  assert.equal(getProfileRes.body.profile.displayName, 'VALKYRIE-PRIME');
  assert.equal(getProfileRes.body.profile.shards, 1250);
});

test('Anti-Cheat: Run submission validation', async () => {
  // Valid run submission
  const validRun = await makeRequest('POST', '/api/runs', {}, {
    displayName: 'TEST-PILOT',
    score: 45000,
    wave: 8,
    survivalTime: 180,
    kills: 60,
    slices: 45,
    styleRank: 'S',
    mode: 'endless'
  });
  assert.equal(validRun.status, 201);
  assert.ok(validRun.body.runId);

  // Reject impossible speed / score cheat
  const cheatedRun = await makeRequest('POST', '/api/runs', {}, {
    displayName: 'HACKER-X',
    score: 99999999,
    wave: 1,
    survivalTime: 2, // 2 seconds cannot yield 100M score
    kills: 5000,
    slices: 5000,
    styleRank: 'SSS',
    mode: 'endless'
  });
  assert.equal(cheatedRun.status, 400);
  assert.match(cheatedRun.body.error, /rejected|bounds|validation|cheat|unrealistic/i);
});

test('Unique Usernames & Case-Insensitive Normalization', async () => {
  const base = Date.now().toString(36).slice(-5);
  const mixedCase = `Chr_${base}`;
  const lowerCase = mixedCase.toLowerCase();
  const upperCase = mixedCase.toUpperCase();

  // 1. Initial registration
  const reg1 = await makeRequest('POST', '/api/auth/register', {}, {
    username: mixedCase,
    password: 'KeyPassword123!',
    email: `${base}@domain.io`
  });
  assert.equal(reg1.status, 201);
  assert.equal(reg1.body.user.username, mixedCase);

  // 2. Exact lowercase registration must be rejected as duplicate
  const reg2 = await makeRequest('POST', '/api/auth/register', {}, {
    username: lowerCase,
    password: 'DifferentPassword123!'
  });
  assert.equal(reg2.status, 409, 'Lowercase duplicate username must be rejected');
  assert.match(reg2.body.error, /already (registered|taken)/i);

  // 3. Uppercase registration must be rejected as duplicate
  const reg3 = await makeRequest('POST', '/api/auth/register', {}, {
    username: upperCase,
    password: 'DifferentPassword123!'
  });
  assert.equal(reg3.status, 409, 'Uppercase duplicate username must be rejected');
  assert.match(reg3.body.error, /already (registered|taken)/i);

  // 4. Reserved usernames must be blocked
  const resAdmin = await makeRequest('POST', '/api/auth/register', {}, {
    username: 'admin',
    password: 'AdminKey12345!'
  });
  assert.equal(resAdmin.status, 400);
  assert.match(resAdmin.body.error, /reserved/i);

  // 5. Callsign availability endpoint check
  const availTaken = await makeRequest('GET', `/api/auth/username-available?username=${lowerCase}`);
  assert.equal(availTaken.status, 200);
  assert.equal(availTaken.body.available, false);

  const availFree = await makeRequest('GET', `/api/auth/username-available?username=av_${Date.now().toString(36).slice(-5)}`);
  assert.equal(availFree.status, 200);
  assert.equal(availFree.body.available, true);

  const availReserved = await makeRequest('GET', `/api/auth/username-available?username=moderator`);
  assert.equal(availReserved.status, 200);
  assert.equal(availReserved.body.available, false);
});

test('Password Recovery & Reset Flow', async () => {
  const uname = `rec_${Date.now().toString(36).slice(-5)}`;
  const email = `${uname}@recovery.net`;
  const oldPass = 'FirstKeyPass123!';
  const newPass = 'UpdatedKeyPass456!';

  // Register account with recovery email
  const reg = await makeRequest('POST', '/api/auth/register', {}, {
    username: uname,
    password: oldPass,
    email: email
  });
  assert.equal(reg.status, 201);

  // Request password reset by username
  const forgotUser = await makeRequest('POST', '/api/auth/forgot-password', {}, {
    identifier: uname
  });
  assert.equal(forgotUser.status, 200);
  assert.ok(forgotUser.body.resetToken, 'Reset token must be provided');

  // Request password reset by email
  const forgotEmail = await makeRequest('POST', '/api/auth/forgot-password', {}, {
    identifier: email
  });
  assert.equal(forgotEmail.status, 200);
  assert.ok(forgotEmail.body.resetToken);

  const token = forgotEmail.body.resetToken;

  // Complete password reset
  const resetRes = await makeRequest('POST', '/api/auth/reset-password', {}, {
    token: token,
    newPassword: newPass
  });
  assert.equal(resetRes.status, 200);
  assert.equal(resetRes.body.ok, true);

  // Login with old password must fail
  const failLogin = await makeRequest('POST', '/api/auth/login', {}, {
    username: uname,
    password: oldPass
  });
  assert.equal(failLogin.status, 401);

  // Login with new password must succeed
  const okLogin = await makeRequest('POST', '/api/auth/login', {}, {
    username: uname,
    password: newPass
  });
  assert.equal(okLogin.status, 200);
  assert.ok(okLogin.body.token);
});

test('Honest Leaderboard: Zero hardcoded bots', async () => {
  const res = await makeRequest('GET', '/api/leaderboard?mode=daily');
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.entries));
  // Zero fake bots check
  for (const entry of res.body.entries) {
    assert.notEqual(entry.displayName, 'APEX-CHRONOS', 'Fake bot must not appear in production leaderboard');
    assert.notEqual(entry.displayName, 'VOID-STALKER', 'Fake bot must not appear in production leaderboard');
    assert.notEqual(entry.displayName, 'KAELEN', 'Hardcoded seed bot must not exist');
  }
});
