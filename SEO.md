# Getting the site found

Everything that can be done in the code is done. What remains needs your Google account, or
a decision only you can make. Read the expectations section first — it is the honest part.

---

## 1. Google Search Console (do this first)

Nothing else matters until Google knows the site exists. This takes about ten minutes.

1. Go to <https://search.google.com/search-console> and sign in.
2. Click **Add property** and choose the **URL prefix** option on the right — *not* Domain,
   which needs DNS you do not control on `github.io`.
3. Enter exactly:

   ```
   https://nikil-srinivasan.github.io/fullscreen-timer/
   ```

4. For verification, pick **HTML tag**. It gives you a line like
   `<meta name="google-site-verification" content="…">`. Send me that line and I will add it
   to `index.html` and deploy it, then you click Verify.

   *Alternative:* the **HTML file** method also works — download the file it gives you, drop
   it in the repository root, and push. Either is fine.

5. Once verified, open **Sitemaps** in the left sidebar and submit:

   ```
   sitemap.xml
   ```

6. Open **URL Inspection**, paste the site URL, and click **Request indexing**. This puts you
   in the queue rather than waiting to be discovered.

Indexing usually takes a few days. Check back in Search Console under **Pages** to confirm
the URL is indexed rather than "Discovered — currently not indexed".

### Bing too

<https://www.bing.com/webmasters> accepts a direct import from Search Console, so it is two
clicks once the above is done. Bing also feeds DuckDuckGo.

---

## 2. What to expect, honestly

**You will not rank on page one for "fullscreen timer" soon, and possibly not ever without
sustained effort.** That query is held by sites with years of accumulated links, direct traffic
and brand recognition. On-page work makes a page *eligible*; it does not make it *win*.

What is realistic:

| Query | Realistic outlook |
| --- | --- |
| `fullscreen timer` | Hard. Established competitors, high intent, years of history. |
| `fullscreen timer github` | Achievable — you own the repository. |
| `timer that hides and shows every 5 minutes` | Genuinely winnable. Almost nobody targets it. |
| `presentation timer for projector` | Winnable with time. |
| `countdown timer big digits 4k` | Winnable. |

Long-tail queries are where a new site earns its first traffic. They convert better too: someone
searching for a timer that flashes every five minutes wants precisely what this does.

---

## 3. The levers that actually move a head term

In descending order of impact:

1. **Links from places people already trust.** One mention in a well-read newsletter or a
   popular repository's README is worth more than any amount of meta-tag tuning. Candidates:
   Show HN, the relevant subreddits (r/publicspeaking, r/Teachers, r/webdev), Product Hunt,
   `awesome-*` lists on GitHub, and alternative-to directories.
2. **A custom domain.** `nikil-srinivasan.github.io/fullscreen-timer/` is a path on a shared
   subdomain and carries little standing of its own. Something like `fullscreentimer.app` is
   the single biggest long-term upgrade. If you buy one, I will add the `CNAME` file, set the
   DNS records and update every absolute URL in the project.
3. **Actual usage.** Search engines watch whether people click a result and stay. A tool that
   people return to feeds that signal by itself — which is the argument for telling the people
   who would genuinely use it, rather than chasing rankings.
4. **More pages worth indexing.** One page competes for one query. Separate pages for
   "presentation timer", "exam timer", "pomodoro timer" — each genuinely different rather than
   the same text reworded — give you several entry points. Say the word and I will build them.

---

## 4. Checking the work

- **Rich results:** <https://search.google.com/test/rich-results> — paste the URL. It should
  report the FAQ structured data as valid.
- **Social card:** <https://www.opengraph.xyz/> — paste the URL to see the preview others get
  when the link is shared.
- **Mobile and vitals:** <https://pagespeed.web.dev/> — the site has no dependencies and no
  build, so it should score very well; anything that does not is worth fixing.

---

## 5. Things deliberately not done

- **No keyword stuffing.** The article reads like something written for a person, because
  Google's own guidance rewards that and penalises the alternative.
- **No hidden keyword text.** The only visually hidden element is the `h1`, which is a standard
  accessibility pattern and matches what the page is about.
- **`robots.txt` is inert here.** Crawlers only read it at a domain root, and this is a project
  site at a path. It stays in the repository because it becomes correct the moment a custom
  domain is attached.
