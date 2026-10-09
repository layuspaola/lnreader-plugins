import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

class BailianTalesPlugin {
  id = 'bailiantales';
  name = 'Bailian Tales';
  icon = 'plugins/english/bailiantales/icon.png';
  site = 'https://bailiantales.com/';
  version = '1.0.7';

  private parseCover($img: any): string {
    let src =
      $img.attr('data-src') ||
      $img.attr('data-lazy-src') \vert{}\vert{}$img.attr('src') ||
      '';

    const srcset = $img.attr('data-srcset') \vert{}\vert{}$img.attr('srcset');
    if (srcset) {
      const firstUrl = srcset.split(',')[0].trim().split(' ')[0];
      if (firstUrl && !firstUrl.startsWith('data:image')) {
        src = firstUrl;
      }
    }

    if (src.startsWith('data:image')) {
      src = $img.attr('data-lazy-src') \vert{}\vert{}$img.attr('data-src') || '';
    }

    src = src.trim();
    if (!src) return '';

    if (src.startsWith('/')) {
      src = 'https://bailiantales.com' + src;
    }

    return src;
  }

  async popularNovels(pageNo: number) {
    // Nueva ruta de listado / navegación
    const url = pageNo === 1 ? this.site : `${this.site}page/${pageNo}/`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    // Adapta tanto selectores viejos como las nuevas cards de la web renovada
    $('.novel-card, .popular-novel-item, .c-tabs-item__content, .page-item-detail, article').each((_, element) => {
      const name = $(element).find('.post-title a, .novel-title a, h3 a, h2 a').first().text().trim();
      const imgObj = $(element).find('img').first();
      const image = this.parseCover(imgObj);
      const link = $(element).find('.post-title a, .novel-title a, h3 a, h2 a, a').first().attr('href');

      if (link && name && !novels.some(n => n.name === name)) {
        novels.push({
          name: name,
          cover: image,
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

    const statusText = $('.post-status, .novel-status, .status').text();
    const imgObj = $('.summary_image img, .novel-cover img, .cover img').first();
    const cover = this.parseCover(imgObj);

    const genresList: string[] = [];
    $('.genres-content a, .novel-genres a, .genres a').each((_, el) => {
      const genre = $(el).text().trim();
      if (genre) {
        genresList.push(genre);
      }
    });

    const novel: any = {
      path: novelPath,
      name: $('.post-title h1, .novel-title h1, h1').first().text().trim() || 'Untitled',
      cover: cover,
      summary: $('.summary__content, .novel-summary, .description').text().trim() || '',
      author: $('.author-content, .novel-author, .author').text().trim() || 'Unknown',
      status: statusText.toLowerCase().includes('ongoing')
        ? NovelStatus.Ongoing
        : statusText.toLowerCase().includes('completed')
        ? NovelStatus.Completed
        : NovelStatus.Unknown,
      genres: genresList.join(', '),
      chapters: [],
    };

    const chapters: any[] = [];

    // 1. Extraer capítulos del HTML estático con selectores ampliados
    $('.wp-manga-chapter, .chapter-item, .chapter-list li, .chapters-list a').each((_, el) => {
      const $a =$(el).find('a').length ? $(el).find('a').first() :$(el);
      const name = $a.text().trim();
      const href = $a.attr('href');
      if (href && name) {
        chapters.push({
          name: name,
          path: href.replace('https://bailiantales.com/', ''),
          releaseTime: $(el).find('.chapter-release-date, .date, time').text().trim() || null,
        });
      }
    });

    // 2. Fallback vía AJAX si no vinieron en el HTML inicial
    if (chapters.length === 0) {
      const mangaId =
        $('#manga-chapters-holder').attr('data-id') ||
        $('[id^="manga-chapters-holder"]').attr('data-id') ||
        $('.rating-post-id').val();

      if (mangaId) {
        let ajaxHtml = '';

        try {
          const directAjax = await fetchApi(`${this.site}novel/${novelPath.replace('novel/', '').replace('/', '')}/ajax/chapters/`, {
            method: 'POST',
          });
          ajaxHtml = await directAjax.text();
        } catch (e) {
          ajaxHtml = '';
        }

        if (!ajaxHtml || !ajaxHtml.includes('chapter')) {
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

        const $ajax = cheerio.load(ajaxHtml);$ajax('.wp-manga-chapter, .chapter-item, li').each((_, el) => {
          const $a =$ajax(el).find('a').length ? $ajax(el).find('a').first() :$ajax(el);
          const name = $a.text().trim();
          const href = $a.attr('href');
          if (href && name) {
            chapters.push({
              name: name,
              path: href.replace('https://bailiantales.com/', ''),
              releaseTime: $ajax(el).find('.chapter-release-date, .date').text().trim() || null,
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

    return $('.read-container, .text-left, .entry-content, .chapter-content, .reading-content').html() || '';
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    const url = `${this.site}?s=${encodeURIComponent(searchTerm)}`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.novel-card, .search-item, .c-tabs-item__content, .page-item-detail, article').each((_, element) => {
      const name = $(element).find('.post-title a, .novel-title a, h3 a, h2 a').first().text().trim();
      const imgObj = $(element).find('img').first();
      const image = this.parseCover(imgObj);
      const link = $(element).find('.post-title a, .novel-title a, h3 a, h2 a, a').first().attr('href');

      if (link && name && !novels.some(n => n.name === name)) {
        novels.push({
          name: name,
          cover: image,
          path: link.replace('https://bailiantales.com/', ''),
        });
      }
    });

    return novels;
  }
}

export default new BailianTalesPlugin();
