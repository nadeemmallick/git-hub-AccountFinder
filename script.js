const APIURL = 'https://api.github.com/users/'

const main = document.getElementById('main')
const form = document.getElementById('form')
const search = document.getElementById('search')
const cache = new Map()
let typingTimer
const DEBOUNCE_MS = 400

async function getUser(username) {
    try {
        renderInfo(`Loading profile for ${username}...`)
        const cacheKey = `user:${username}`
        let data
        if (cache.has(cacheKey)) {
            data = cache.get(cacheKey)
        } else {
            const res = await axios(APIURL + username)
            data = res.data
            cache.set(cacheKey, data)
        }

        createUserCard(data)
        getRepos(username)
    } catch (err) {
        const status = err?.response?.status
        if (status === 404) {
            createErrorCard('No profile with this username')
        } else if (status === 403) {
            const reset = err.response.headers?.['x-ratelimit-reset']
            const resetDate = reset ? new Date(Number(reset) * 1000) : null
            const msg = resetDate
                ? `GitHub rate limit reached. Try again at ${resetDate.toLocaleTimeString()}.`
                : 'GitHub rate limit reached. Please try again later.'
            createErrorCard(msg)
        } else {
            createErrorCard('Something went wrong fetching the user')
        }
    }
}

async function getRepos(username) {
    try {
        const reposEl = ensureReposContainer()
        reposEl.innerHTML = '<div class="spinner" aria-label="Loading repositories"></div>'

        const cacheKey = `repos:${username}`
        let data
        if (cache.has(cacheKey)) {
            data = cache.get(cacheKey)
        } else {
            const res = await axios(APIURL + username + '/repos?sort=created')
            data = res.data
            cache.set(cacheKey, data)
        }

        // Compute top languages and render chips
        renderTopLanguages(data)

        addReposToCard(data)
    } catch (err) {
        createErrorCard('Problem fetching repos')
    }
}

function createUserCard(user) {
    const userID = user.name || user.login
    const userBio = user.bio ? `<p>${user.bio}</p>` : ''
    const location = user.location ? `<span class="chip" title="Location">📍 ${user.location}</span>` : ''
    const company = user.company ? `<span class="chip" title="Company">🏢 ${user.company}</span>` : ''
    const website = user.blog ? `<a class="chip chip-link" href="${normalizeUrl(user.blog)}" target="_blank" rel="noopener" title="Website">🔗 Website</a>` : ''
    const twitter = user.twitter_username ? `<a class="chip chip-link" href="https://twitter.com/${user.twitter_username}" target="_blank" rel="noopener" title="Twitter">𝕏 @${user.twitter_username}</a>` : ''
    const joined = user.created_at ? `<span class="chip" title="Joined">📅 Joined ${new Date(user.created_at).toLocaleDateString()}</span>` : ''

    const cardHTML = `
    <div class="card">
    <div>
      <img src="${user.avatar_url}" alt="${user.name}" class="avatar">
    </div>
    <div class="user-info">
      <h2>${userID}</h2>
      ${userBio}
      <ul>
        <li>${formatNumber(user.followers)} <strong>Followers</strong></li>
        <li>${formatNumber(user.following)} <strong>Following</strong></li>
        <li>${formatNumber(user.public_repos)} <strong>Repos</strong></li>
      </ul>

      <div class="meta">${location} ${company} ${website} ${twitter} ${joined}</div>

      <div class="languages" id="languages"></div>

      <div class="actions">
        <a class="btn" href="${user.html_url}" target="_blank" rel="noopener">View on GitHub</a>
      </div>

      <h3 class="section-title">Top Repositories</h3>
      <div id="repos"></div>
    </div>
  </div>
    `
    main.innerHTML = cardHTML

}

function createErrorCard(msg) {
    const cardHTML = `
        <div class="card">
            <h1>${msg}</h1>
        </div>
    `

    main.innerHTML = cardHTML
}

function renderInfo(msg) {
    const cardHTML = `
        <div class="card">
            <p>${msg}</p>
        </div>
    `
    main.innerHTML = cardHTML
}

function ensureReposContainer() {
    let reposEl = document.getElementById('repos')
    if (!reposEl) {
        const wrapper = document.createElement('div')
        wrapper.id = 'repos'
        main.appendChild(wrapper)
        reposEl = wrapper
    }
    return reposEl
}

function formatNumber(n) {
    if (typeof Intl !== 'undefined' && Intl.NumberFormat) {
        return new Intl.NumberFormat().format(n)
    }
    return n
}

function normalizeUrl(url) {
    if (!url) return '#'
    if (/^https?:\/\//i.test(url)) return url
    return `https://${url}`
}

function relativeTime(iso) {
    try {
        const d = new Date(iso)
        const diff = Date.now() - d.getTime()
        const sec = Math.floor(diff / 1000)
        const min = Math.floor(sec / 60)
        const hr = Math.floor(min / 60)
        const day = Math.floor(hr / 24)
        if (day > 0) return `${day}d ago`
        if (hr > 0) return `${hr}h ago`
        if (min > 0) return `${min}m ago`
        return `${sec}s ago`
    } catch {
        return ''
    }
}

function renderTopLanguages(repos) {
    const langEl = document.getElementById('languages')
    if (!langEl) return
    const counts = {}
    repos.forEach(r => {
        if (r.language) {
            counts[r.language] = (counts[r.language] || 0) + 1
        }
    })
    const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5)
    if (!entries.length) {
        langEl.innerHTML = ''
        return
    }
    langEl.innerHTML = entries.map(([lang, count]) => `<span class="chip chip-pill" title="Repos using ${lang}">${lang} • ${count}</span>`).join(' ')
}

function addReposToCard(repos) {
    const reposEl = document.getElementById('repos')

    reposEl.innerHTML = ''
    const top = repos.slice(0, 8)
    if (!top.length) {
        reposEl.innerHTML = '<p>No public repositories.</p>'
        return
    }
    top.forEach(repo => {
        const repoEl = document.createElement('a')
        repoEl.classList.add('repo')
        repoEl.href = repo.html_url
        repoEl.target = '_blank'
        repoEl.rel = 'noopener'
        const lang = repo.language ? ` • ${repo.language}` : ''
        const updated = repo.pushed_at ? ` • ⏱ ${relativeTime(repo.pushed_at)}` : ''
        repoEl.innerText = `${repo.name}  ⭐${formatNumber(repo.stargazers_count || 0)} • 🍴${formatNumber(repo.forks_count || 0)}${lang}${updated}`
        reposEl.appendChild(repoEl)
    })
}

form.addEventListener('submit', (e) => {
    e.preventDefault()

    const user = search.value

    if (user) {
        getUser(user)

        search.value = ''
    }
})

// Debounced search as you type
search.addEventListener('input', () => {
    clearTimeout(typingTimer)
    const user = search.value.trim()
    if (!user) {
        main.innerHTML = ''
        return
    }
    typingTimer = setTimeout(() => {
        getUser(user)
    }, DEBOUNCE_MS)
})
