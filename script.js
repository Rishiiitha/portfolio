const menuButton = document.querySelector('.menu-toggle');
const mainNav = document.querySelector('.main-nav');

menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!expanded));
  menuButton.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
  mainNav.classList.toggle('open', !expanded);
});

mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
  });
});

const sections = [...document.querySelectorAll('main section[id]')];
const navLinks = [...mainNav.querySelectorAll('a')];
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => {
      link.classList.toggle('active', link.hash === `#${entry.target.id}`);
    });
  });
}, { rootMargin: '-30% 0px -60% 0px' });
sections.forEach((section) => observer.observe(section));

const gridCursor = document.querySelector('.grid-cursor');
const cursorGuides = document.querySelector('.cursor-guides');
const finePointer = window.matchMedia('(pointer: fine)');
if (gridCursor && cursorGuides && finePointer.matches) {
  const cellSize = Number.parseFloat(getComputedStyle(gridCursor).width) || 5;
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const cellX = Math.floor(event.clientX / cellSize) * cellSize;
    const cellY = Math.floor(event.clientY / cellSize) * cellSize;
    gridCursor.style.transform = `translate3d(${cellX}px, ${cellY}px, 0)`;
    gridCursor.style.setProperty('--pointer-x', `${event.clientX - cellX}px`);
    gridCursor.style.setProperty('--pointer-y', `${event.clientY - cellY}px`);
    cursorGuides.style.setProperty('--cursor-x', `${event.clientX}px`);
    cursorGuides.style.setProperty('--cursor-y', `${event.clientY}px`);
    gridCursor.classList.add('is-visible');
    cursorGuides.classList.add('is-visible');
    gridCursor.classList.toggle('is-link', Boolean(event.target.closest('a, button, [role="button"]')));
  }, { passive: true });

  document.documentElement.addEventListener('pointerleave', () => {
    gridCursor.classList.remove('is-visible');
    cursorGuides.classList.remove('is-visible');
  });
}

const leetcodeKey = 'rishitha-leetcode-live-v2';
const githubKey = 'rishitha-github-live-v1';
const heatmapKey = 'rishitha-github-heatmap-v1';
const cacheWindow = 15 * 60 * 1000;
const heatmapCacheWindow = 60 * 60 * 1000;

function readProfileCache(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && Date.now() - value.savedAt < 24 * 60 * 60 * 1000 ? value : null;
  } catch {
    return null;
  }
}

function saveProfileCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Live data still renders when browser storage is unavailable.
  }
}

function shortTime(date) {
  const minutes = Math.max(1, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function stampNow() {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function renderLeetCode(data, source = 'LIVE', savedAt = Date.now()) {
  const counts = Object.fromEntries(data.matchedUser.submitStats.acSubmissionNum.map(({ difficulty, count }) => [difficulty, count]));
  const totals = Object.fromEntries(data.allQuestionsCount.map(({ difficulty, count }) => [difficulty, count]));
  const total = counts.All ?? ((counts.Easy || 0) + (counts.Medium || 0) + (counts.Hard || 0));
  document.querySelector('#leetcode-total').textContent = total.toLocaleString();
  for (const difficulty of ['Easy', 'Medium', 'Hard']) {
    document.querySelector(`#leetcode-${difficulty.toLowerCase()}`).textContent = (counts[difficulty] || 0).toLocaleString();
    const progress = totals[difficulty] ? Math.min(100, (counts[difficulty] / totals[difficulty]) * 100) : 0;
    document.querySelector(`#bar-${difficulty.toLowerCase()}`).style.width = `${progress}%`;
  }
  const contest = data.contest;
  document.querySelector('#leetcode-rating').textContent = contest?.rating ? Math.round(contest.rating).toLocaleString() : '—';
  document.querySelector('#leetcode-rank').textContent = contest?.globalRanking ? contest.globalRanking.toLocaleString() : '—';
  document.querySelector('#leetcode-contests').textContent = contest?.attendedContestsCount?.toLocaleString() || '—';
  document.querySelector('#leetcode-top').textContent = Number.isFinite(contest?.topPercentage) ? `${contest.topPercentage.toFixed(1)}%` : '—';
  document.querySelector('#leetcode-status').textContent = source === 'CACHED' ? `CACHED · ${shortTime(new Date(savedAt))}` : `${source} · UPDATED ${stampNow()}`;
}

async function loadLeetCode() {
  const status = document.querySelector('#leetcode-status');
  const cached = readProfileCache(leetcodeKey);
  if (cached) {
    renderLeetCode(cached.data, 'CACHED', cached.savedAt);
    if (Date.now() - cached.savedAt < cacheWindow) return;
  }
  const query = `query Profile($username: String!) {
    matchedUser(username: $username) {
      submitStats { acSubmissionNum { difficulty count } }
      userCalendar { streak totalActiveDays }
    }
    userContestRanking(username: $username) { rating globalRanking attendedContestsCount topPercentage }
    allQuestionsCount { difficulty count }
  }`;
  const params = new URLSearchParams({ query, variables: JSON.stringify({ username: 'Rishitha-V' }) });
  try {
    const response = await fetch(`https://proxy.cors.dev/https://leetcode.com/graphql?${params.toString()}`, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`LeetCode returned ${response.status}`);
    const payload = await response.json();
    if (!payload.data?.matchedUser) throw new Error('LeetCode profile was not found');
    const data = { matchedUser: payload.data.matchedUser, allQuestionsCount: payload.data.allQuestionsCount, contest: payload.data.userContestRanking };
    saveProfileCache(leetcodeKey, data);
    renderLeetCode(data);
  } catch {
    status.textContent = cached ? 'SHOWING CACHED STATS · LIVE REFRESH UNAVAILABLE' : 'LIVE DATA UNAVAILABLE · OPEN PROFILE ↗';
  }
}

function describeEvent(event) {
  const repo = event.repo?.name || 'a public repository';
  const payload = event.payload || {};
  switch (event.type) {
    case 'PushEvent': {
      const count = payload.size || payload.commits?.length || 1;
      const lastMessage = payload.commits?.at(-1)?.message?.split('\n')[0];
      return { action: `Pushed ${count} ${count === 1 ? 'commit' : 'commits'}${lastMessage ? ` · ${lastMessage}` : ''}`, repo };
    }
    case 'PullRequestEvent': return { action: `${payload.action || 'Updated'} a pull request`, repo };
    case 'IssuesEvent': return { action: `${payload.action || 'Updated'} an issue`, repo };
    case 'IssueCommentEvent': return { action: 'Commented on an issue', repo };
    case 'CreateEvent': return { action: `Created ${payload.ref_type || 'a branch'}`, repo };
    case 'WatchEvent': return { action: 'Starred a repository', repo };
    case 'ForkEvent': return { action: 'Forked a repository', repo };
    case 'ReleaseEvent': return { action: 'Published a release', repo };
    default: return { action: event.type?.replace(/Event$/, '').replace(/([a-z])([A-Z])/g, '$1 $2') || 'Activity', repo };
  }
}

function renderGitHub(data, source = 'LIVE', savedAt = Date.now()) {
  document.querySelector('#github-repos').textContent = (data.profile.public_repos || data.repos.length).toLocaleString();
  document.querySelector('#github-stars').textContent = data.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0).toLocaleString();
  document.querySelector('#github-followers').textContent = (data.profile.followers || 0).toLocaleString();
  const feed = document.querySelector('#github-feed');
  feed.replaceChildren();
  const events = data.events.slice(0, 5);
  if (!events.length) {
    const empty = document.createElement('li');
    empty.className = 'activity-placeholder';
    empty.textContent = 'No recent public events. The repositories are still open to explore.';
    feed.append(empty);
  }
  for (const event of events) {
    const summary = describeEvent(event);
    const row = document.createElement('li');
    const marker = document.createElement('i');
    const text = document.createElement('span');
    const action = document.createElement('span');
    action.textContent = `${summary.action} in `;
    const repoLink = document.createElement('a');
    repoLink.href = `https://github.com/${summary.repo}`;
    repoLink.target = '_blank';
    repoLink.rel = 'noreferrer';
    repoLink.textContent = summary.repo.split('/').pop();
    action.append(repoLink);
    text.append(action);
    const time = document.createElement('time');
    time.dateTime = event.created_at;
    time.textContent = shortTime(new Date(event.created_at));
    row.append(marker, text, time);
    feed.append(row);
  }
  document.querySelector('#github-status').textContent = source === 'CACHED' ? `CACHED · ${shortTime(new Date(savedAt))}` : `${source} · ${stampNow()}`;
  document.querySelector('#github-status').dataset.updatedAt = String(Date.now());
}

async function loadGitHub() {
  const status = document.querySelector('#github-status');
  const cached = readProfileCache(githubKey);
  if (cached) {
    renderGitHub(cached.data, 'CACHED', cached.savedAt);
    if (Date.now() - cached.savedAt < cacheWindow) return;
  }
  const headers = { Accept: 'application/vnd.github+json' };
  try {
    const [profileResponse, reposResponse, eventsResponse] = await Promise.all([
      fetch('https://api.github.com/users/Rishiiitha', { headers, credentials: 'omit' }),
      fetch('https://api.github.com/users/Rishiiitha/repos?per_page=100&sort=updated', { headers, credentials: 'omit' }),
      fetch('https://api.github.com/users/Rishiiitha/events/public?per_page=8', { headers, credentials: 'omit' })
    ]);
    if (![profileResponse, reposResponse, eventsResponse].every((response) => response.ok)) throw new Error('GitHub data unavailable');
    const [profile, repos, events] = await Promise.all([profileResponse.json(), reposResponse.json(), eventsResponse.json()]);
    const data = { profile, repos, events };
    saveProfileCache(githubKey, data);
    renderGitHub(data);
  } catch {
    status.textContent = cached ? 'SHOWING CACHED DATA' : 'LIVE FEED UNAVAILABLE';
    if (!cached) {
      const feed = document.querySelector('#github-feed');
      feed.replaceChildren();
      const fallback = document.createElement('li');
      fallback.className = 'activity-placeholder';
      fallback.textContent = 'Could not load the latest events. Visit GitHub for the full activity feed.';
      feed.append(fallback);
    }
  }
}

function renderGitHubHeatmap(data, source = 'LIVE', savedAt = Date.now()) {
  const days = [...(data.contributions || [])]
    .filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const grid = document.querySelector('#github-heatmap');
  grid.replaceChildren();
  const firstDate = days[0] ? new Date(`${days[0].date}T00:00:00Z`) : null;
  const leading = firstDate ? firstDate.getUTCDay() : 0;
  for (let index = 0; index < leading; index += 1) {
    const blank = document.createElement('span');
    blank.className = 'heatmap-cell is-empty';
    blank.setAttribute('aria-hidden', 'true');
    grid.append(blank);
  }
  let computedTotal = 0;
  for (const day of days) {
    const count = Number(day.count) || 0;
    computedTotal += count;
    const cell = document.createElement('span');
    cell.className = 'heatmap-cell';
    cell.dataset.level = String(Math.max(0, Math.min(4, Number(day.level) || 0)));
    cell.title = `${day.date}: ${count} contribution${count === 1 ? '' : 's'}`;
    cell.setAttribute('role', 'gridcell');
    cell.setAttribute('aria-label', cell.title);
    grid.append(cell);
  }
  const reportedTotal = data.total?.lastYear ?? Object.values(data.total || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  document.querySelector('#github-contribution-total').textContent = (Number(reportedTotal) || computedTotal).toLocaleString();
  document.querySelector('#heatmap-status').textContent = source === 'CACHED' ? `CACHED · ${shortTime(new Date(savedAt))}` : `UPDATED ${stampNow()}`;
}

async function loadGitHubHeatmap() {
  const status = document.querySelector('#heatmap-status');
  const cached = readProfileCache(heatmapKey);
  if (cached) {
    renderGitHubHeatmap(cached.data, 'CACHED', cached.savedAt);
    if (Date.now() - cached.savedAt < heatmapCacheWindow) return;
  }
  try {
    const response = await fetch('https://github-contributions-api.jogruber.de/v4/Rishiiitha?y=last', { headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!response.ok) throw new Error(`Contribution service returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.contributions)) throw new Error('Contribution data is unavailable');
    saveProfileCache(heatmapKey, data);
    renderGitHubHeatmap(data);
  } catch {
    status.textContent = cached ? 'SHOWING CACHED ACTIVITY' : 'HEATMAP UNAVAILABLE · OPEN GITHUB';
  }
}

loadLeetCode();
loadGitHub();
loadGitHubHeatmap();

const revealSelectors = '.section-kicker, .section-heading, .about-grid, .skills-line, .signal-panel, .project-card, .timeline-item, .recognition-card, .contact-grid';
const revealItems = document.querySelectorAll(revealSelectors);
revealItems.forEach((item, index) => {
  item.classList.add('reveal');
  item.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
});
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

if (finePointer.matches) {
  document.querySelectorAll('.project-card, .signal-panel').forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--glow-x', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--glow-y', `${event.clientY - bounds.top}px`);
    }, { passive: true });
  });
}
