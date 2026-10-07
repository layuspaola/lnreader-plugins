import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

export const id = 'bailiantales';
export const name = 'Bailian Tales';
export const site = 'https://bailiantales.com/';
export const version = '1.0.1';
export const icon = 'plugins/en/bailiantales/icon.png';

export default class BailianTalesPlugin {
  constructor() {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.site = site;
    this.version = version;
  }

  async popularNovels(page) {
    const url = `${this.site}page/${page}/?s&post_type=wp-manga&m_orderby=views`;
    const res = await fetchApi(url);
    const body = await res.text();
    const $ = cheerio.load(body);

    const novels = [];
    $('.c-tabs-item__content').each((i, el) => {
      const name = $(el).find('.post-title a').text().trim();
      const image = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
      const link = $(el).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image || '',
          path: link.replace(this.site, ''),
        });
      }
    });

    return novels;
  }

  async parseNovel(novelPath) {
    const url = this.site + novelPath;
    const res = await fetchApi(url);
    const body = await res.text();
    const $ = cheerio.load(body);

    const novel = {
      path: novelPath,
      name: $('.post-title h1').text().trim() || 'Untitled',
      cover: $('.summary_image img').attr('src') \vert{}\vert{}$('.summary_image img').attr('data-src') || '',
      summary: $('.summary__content').text().trim() || '',
      author: $('.author-content').text().trim() || 'Unknown',
      status: $('.post-status').text().includes('OnGoing') ? NovelStatus.Ongoing : NovelStatus.Completed,
      genres: $('.genres-content a').map((i, el) =>$(el).text().trim()).get().join(', '),
      chapters: [],
    };

    const chapters = [];

    // Intento 1: Extracción directa si están en el HTML
    $('.wp-manga-chapter').each((i, el) => {
      const name = $(el).find('a').text().trim();
      const href = $(el).find('a').attr('href');
      if (href) {
        chapters.push({
          name: name,
          path: href.replace(this.site, ''),
          releaseTime: $(el).find('.chapter-release-date').text().trim() || null,
        });
      }
    });

    // Intento 2: Extracción vía AJAX si la lista vino vacía
    if (chapters.length === 0) {
      const mangaId = $('#manga-chapters-holder').attr('data-id');
      if (mangaId) {
        const formData = new FormData();
        formData.append('action', 'manga_get_chapters');
        formData.append('manga', mangaId);

        const ajaxRes = await fetchApi(`${this.site}wp-admin/admin-ajax.php`, {
          method: 'POST',
          body: formData,
        });
        const ajaxHtml = await ajaxRes.text();
        const $ajax = cheerio.load(ajaxHtml);

        $ajax('.wp-manga-chapter').each((i, el) => {
          const name = $ajax(el).find('a').text().trim();
          const href = $ajax(el).find('a').attr('href');
          if (href) {
            chapters.push({
              name: name,
              path: href.replace(this.site, ''),
              releaseTime: $ajax(el).find('.chapter-release-date').text().trim() || null,
            });
          }
        });
      }
    }

    novel.chapters = chapters.reverse();
    return novel;
  }

  async parseChapter(chapterPath) {
    const url = this.site + chapterPath;
    const res = await fetchApi(url);
    const body = await res.text();
    const $ = cheerio.load(body);

    const chapterText = $('.read-container, .text-left').html() || '';
    return chapterText;
  }

  async searchNovels(searchTerm, page) {
    const url = `${this.site}page/${page}/?s=${encodeURI(searchTerm)}&post_type=wp-manga`;
    const res = await fetchApi(url);
    const body = await res.text();
    const $ = cheerio.load(body);

    const novels = [];
    $('.c-tabs-item__content').each((i, el) => {
      const name = $(el).find('.post-title a').text().trim();
      const image = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
      const link = $(el).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image || '',
          path: link.replace(this.site, ''),
        });
      }
    });

    return novels;
  }
}
