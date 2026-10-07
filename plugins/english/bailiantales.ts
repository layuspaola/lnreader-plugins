import { fetchApi } from '@libs/fetch';
import { NovelStatus } from '@libs/novelStatus';
import cheerio from 'cheerio';

class BailianTalesPlugin {
  id = 'bailiantales-en';
  name = 'Bailian Tales';
  icon = 'plugins/english/bailiantales/icon.png';
  site = 'https://bailiantales.com/';
  version = '1.0.6';

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

    // Si la URL es relativa (/wp-content/...), adjunta el dominio base
    if (src.startsWith('/')) {
      src = 'https://bailiantales.com' + src;
    }

    return src;
  }

  async popularNovels(pageNo: number) {
    const url = `${this.site}page/${pageNo}/?s=&post_type=wp-manga&m_orderby=views`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content, .page-item-detail').each((_, element) => {
      const name = $(element).find('.post-title a').text().trim();
      const imgObj = $(element).find('img').first();
      const image = this.parseCover(imgObj);
      const link = $(element).find('.post-title a').attr('href');

      if (link && name) {
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

    const statusText = $('.post-status').text();
    const imgObj = $('.summary_image img').first();
    const cover = this.parseCover(imgObj);

    const genresList: string[] = [];
    $('.genres-content a').each((_, el) => {
      const genre = $(el).text().trim();
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

    $('.wp-manga-chapter').each((_, el) => {
      const name = $(el).find('a').text().trim();
      const href = $(el).find('a').attr('href');
      if (href) {
        chapters.push({
          name: name,
          path: href.replace('https://bailiantales.com/', ''),
          releaseTime: $(el).find('.chapter-release-date').text().trim() || null,
        });
      }
    });

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

        const $ajax = cheerio.load(ajaxHtml);$ajax('.wp-manga-chapter').each((_, el) => {
          const name = $ajax(el).find('a').text().trim();
          const href = $ajax(el).find('a').attr('href');
          if (href) {
            chapters.push({
              name: name,
              path: href.replace('https://bailiantales.com/', ''),
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

    return $('.read-container, .text-left, .entry-content').html() || '';
  }

  async searchNovels(searchTerm: string, pageNo: number) {
    const url = `${this.site}page/${pageNo}/?s=${encodeURIComponent(searchTerm)}&post_type=wp-manga`;
    const res = await fetchApi(url);
    const text = await res.text();
    const $ = cheerio.load(text);

    const novels: any[] = [];

    $('.c-tabs-item__content, .page-item-detail').each((_, element) => {
      const name = $(element).find('.post-title a').text().trim();
      const imgObj = $(element).find('img').first();
      const image = this.parseCover(imgObj);
      const link = $(element).find('.post-title a').attr('href');

      if (link && name) {
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
