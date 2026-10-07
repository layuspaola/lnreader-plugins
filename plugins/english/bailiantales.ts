import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

class BailianTalesPlugin {
  id = 'bailiantales-en';
  name = 'Bailian Tales';
  icon = 'plugins/english/bailiantales/icon.png';
  site = 'https://bailiantales.com/';
  version = '1.0.4';

  async popularNovels(pageNo: number) {
    const url = `${this.site}page/${pageNo}/?s&post_type=wp-manga&m_orderby=views`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content, .page-item-detail').each(function () {
      const name = $(this).find('.post-title a').text().trim();
      const imgObj = $(this).find('img');
      const image =
        imgObj.attr('data-src') ||
        imgObj.attr('data-lazy-src') ||
        imgObj.attr('src') ||
        '';
      const link = $(this).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image.split(' ')[0], // Limpia query params o srcset
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
      cover: cover.split(' ')[0],
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

    // 1. Extraer capítulos del HTML principal
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

    // 2. Si no encontró capítulos, consulta el endpoint ajax/chapters/ o admin-ajax.php con headers
    if (chapters.length === 0) {
      const mangaId =
        $('#manga-chapters-holder').attr('data-id') ||
        $('[id^="manga-chapters-holder"]').attr('data-id') ||
        $('.rating-post-id').val();

      if (mangaId) {
        let ajaxHtml = '';

        // Probar endpoint directo /ajax/chapters/
        try {
          const directAjax = await fetchApi(`${this.site}novel/${novelPath.replace('novel/', '').replace('/', '')}/ajax/chapters/`, {
            method: 'POST',
          });
          ajaxHtml = await directAjax.text();
        } catch (e) {
          ajaxHtml = '';
        }

        // Si el endpoint falló, usar admin-ajax con cabeceras completas
        if (!ajaxHtml || !ajaxHtml.includes('wp-manga-chapter')) {
          const formData = new URLSearchParams();
          formData.append('action', 'manga_get_chapters');
          formData.append('manga', mangaId.toString());

          const ajaxRes = await fetchApi(`${this.site}wp-admin/admin-ajax.php`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': url,
            },
            body: formData.toString(),
          });
          ajaxHtml = await ajaxRes.text();
        }

        const $ajax = cheerio.load(ajaxHtml);$ajax('.wp-manga-chapter').each(function () {
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
    const url = `${this.site}page/${pageNo}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content, .page-item-detail').each(function () {
      const name = $(this).find('.post-title a').text().trim();
      const imgObj = $(this).find('img');
      const image =
        imgObj.attr('data-src') ||
        imgObj.attr('data-lazy-src') ||
        imgObj.attr('src') ||
        '';
      const link = $(this).find('.post-title a').attr('href');

      if (link && name) {
        novels.push({
          name: name,
          cover: image.split(' ')[0],
          path: link.replace('https://bailiantales.com/', ''),
        });
      }
    });

    return novels;
  }
}

export default new BailianTalesPlugin();
