import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

class BailianTalesPlugin {
  id = 'bailiantales-en';
  name = 'Bailian Tales';
  icon = 'plugins/english/bailiantales/icon.png';
  site = 'https://bailiantales.com/';
  version = '1.0.2';

  async popularNovels(pageNo: number) {
    const url = this.site + 'page/' + pageNo + '/?s&post_type=wp-manga&m_orderby=views';
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content').each(function () {
      const name = $(this).find('.post-title a').text().trim();
      const imgObj = $(this).find('img');
      const image = imgObj.attr('data-src') || imgObj.attr('data-lazy-src') || imgObj.attr('src');
      const link = $(this).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image || '',
          path: link.replace('https://bailiantales.com/', ''),
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

    // Extraer imagen buscando en data-src, data-lazy-src o src
    const imgObj = $('.summary_image img');
    const cover =
      imgObj.attr('data-src') ||
      imgObj.attr('data-lazy-src') ||
      imgObj.attr('src') ||
      '';

    const genresList: string[] = [];
    $('.genres-content a').each(function () {
      const genre = $(this).text().trim();
      if (genre) {
        genresList.push(genre);
      }
    });

    const novel: any = {
      path: novelPath,
      name: $('.post-title h1').text().trim() || 'Untitled',
      cover: cover,
      summary: $('.summary__content').text().trim() || '',
      author: $('.author-content').text().trim() || 'Unknown',
      status: statusText.includes('OnGoing')
        ? NovelStatus.Ongoing
        : statusText.includes('Completed')
        ? NovelStatus.Completed
        : NovelStatus.Unknown,
      genres: genresList.join(', '),
      chapters: [],
    };

    const chapters: any[] = [];

    // Intento 1: Capítulos estáticos directos en el DOM
    $('.wp-manga-chapter').each(function () {
      const name = $(this).find('a').text().trim();
      const href = $(this).find('a').attr('href');
      if (href) {
        chapters.push({
          name: name,
          path: href.replace('https://bailiantales.com/', ''),
          releaseTime: $(this).find('.chapter-release-date').text().trim() || null,
        });
      }
    });

    // Intento 2: Carga vía admin-ajax.php con formdata codificado en URL
    if (chapters.length === 0) {
      const mangaId = $('#manga-chapters-holder').attr('data-id') || $('[id^="manga-chapters-holder"]').attr('data-id');
      if (mangaId) {
        const formData = new URLSearchParams();
        formData.append('action', 'manga_get_chapters');
        formData.append('manga', mangaId);

        const ajaxRes = await fetchApi(this.site + 'wp-admin/admin-ajax.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          },
          body: formData.toString(),
        });
        const ajaxHtml = await ajaxRes.text();
        const $ajax = cheerio.load(ajaxHtml);

        $ajax('.wp-manga-chapter').each(function () {
          const name = $ajax(this).find('a').text().trim();
          const href = $ajax(this).find('a').attr('href');
          if (href) {
            chapters.push({
              name: name,
              path: href.replace('https://bailiantales.com/', ''),
              releaseTime: $ajax(this).find('.chapter-release-date').text().trim() || null,
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

    return $('.read-container, .text-left, .entry-content').html() || '';
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    const url = this.site + 'page/' + pageNo + '/?s=' + encodeURIComponent(searchTerm) + '&post_type=wp-manga';
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content').each(function () {
      const name = $(this).find('.post-title a').text().trim();
      const imgObj = $(this).find('img');
      const image = imgObj.attr('data-src') || imgObj.attr('data-lazy-src') || imgObj.attr('src');
      const link = $(this).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image || '',
          path: link.replace('https://bailiantales.com/', ''),
        });
      }
    });

    return novels;
  }
}

export default new BailianTalesPlugin();
