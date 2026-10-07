import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

class BailianTalesPlugin {
  id: string;
  name: string;
  icon: string;
  site: string;
  version: string;

  constructor() {
    this.id = 'bailiantales';
    this.name = 'Bailian Tales';
    this.icon = 'plugins/en/bailiantales/icon.png';
    this.site = 'https://bailiantales.com/';
    this.version = '1.0.1';
  }

  async popularNovels(pageNo: number) {
    const url = `${this.site}page/${pageNo}/?s&post_type=wp-manga&m_orderby=views`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content').each((_, el) => {
      const name = $(el).find('.post-title a').text().trim();
      const image = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
      const link = $(el).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name,
          cover: image || '',
          path: link.replace(this.site, ''),
        });
      }
    });

    return novels;
  }

  async parseNovel(novelPath: string) {
    const url = this.site + novelPath;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const statusText = $('.post-status').text();

    const novel: any = {
      path: novelPath,
      name: $('.post-title h1').text().trim() || 'Untitled',
      cover: $('.summary_image img').attr('src') \vert{}\vert{}$('.summary_image img').attr('data-src') || '',
      summary: $('.summary__content').text().trim() || '',
      author: $('.author-content').text().trim() || 'Unknown',
      status: statusText.includes('OnGoing')
        ? NovelStatus.Ongoing
        : statusText.includes('Completed')
        ? NovelStatus.Completed
        : NovelStatus.Unknown,
      genres: $('.genres-content a')
        .map((_, el) => $(el).text().trim())
        .get()
        .join(', '),
      chapters: [],
    };

    const chapters: any[] = [];

    $('.wp-manga-chapter').each((_, el) => {
      const name = $(el).find('a').text().trim();
      const href = $(el).find('a').attr('href');
      if (href) {
        chapters.push({
          name,
          path: href.replace(this.site, ''),
          releaseTime: $(el).find('.chapter-release-date').text().trim() || null,
        });
      }
    });

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

        $ajax('.wp-manga-chapter').each((_, el) => {
          const name = $ajax(el).find('a').text().trim();
          const href = $ajax(el).find('a').attr('href');
          if (href) {
            chapters.push({
              name,
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

  async parseChapter(chapterPath: string) {
    const url = this.site + chapterPath;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    return $('.read-container, .text-left').html() || '';
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    const url = `${this.site}page/${pageNo}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content').each((_, el) => {
      const name = $(el).find('.post-title a').text().trim();
      const image = $(el).find('img').attr('src') \vert{}\vert{}$(el).find('img').attr('data-src');
      const link = $(el).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name,
          cover: image || '',
          path: link.replace(this.site, ''),
        });
      }
    });

    return novels;
  }
}

export default new BailianTalesPlugin();
