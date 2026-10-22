# ai-otonom

Tüm projeleri **Claude ile otonom** hale getiren merkezi proje.

Her proje, bu depodaki yeniden kullanılabilir workflow'ları çağıran küçük dosyalar içerir.
Asıl mantık burada durur: bir prompt'u, izni veya davranışı burada değiştirdiğinizde
**tüm projeler bunu otomatik olarak kullanmaya başlar**.

## Projelere ne kazandırır?

| Özellik | Dosya (projede) | Ne yapar |
|---|---|---|
| `mention` | `.github/workflows/claude.yml` | Issue/PR'da `@claude` yazınca soruları yanıtlar, kod yazar, PR açar |
| `review` | `.github/workflows/claude-review.yml` | Açılan/güncellenen her PR'ı otomatik inceler |
| `maintenance` | `.github/workflows/claude-maintenance.yml` | Zamanlanmış bakım: testleri çalıştırır, bozuk olanı veya güvenlik açıklarını düzeltip PR açar |
| — | `CLAUDE.md` | Projeye özel kurallar (yalnızca yoksa oluşturulur, sonra sizin) |

## Yapı

```
.github/workflows/
  claude-mention.yml      # yeniden kullanılabilir: @claude yanıtları
  claude-review.yml       # yeniden kullanılabilir: otomatik PR incelemesi
  claude-maintenance.yml  # yeniden kullanılabilir: zamanlanmış bakım
  sync.yml                # projects.json'ı tüm projelere uygular
  claude.yml, ci.yml      # bu deponun kendi otomasyonu
templates/                # projelere eklenen dosyaların şablonları
src/                      # senkronizasyon CLI'ı (TypeScript, bağımlılıksız)
projects.json             # yönetilen projelerin listesi
```

## Kurulum (bir kez)

1. **Claude GitHub App**'i kurun ve tüm depolara erişim verin: https://github.com/apps/claude
2. Bu depoda `main` dalının olduğundan emin olun (projeler workflow'ları `@main`'den çağırır).
3. Bir **fine-grained PAT** oluşturun (Settings → Developer settings → Fine-grained tokens):
   - Repository access: yönetilecek tüm depolar
   - İzinler: **Contents**, **Pull requests**, **Workflows** → Read and write
4. Bu deponun Settings → Secrets → Actions bölümüne `OTONOM_GH_TOKEN` olarak ekleyin.
5. Bu depoya ve her projeye `ANTHROPIC_API_KEY` (veya `claude setup-token` ile alınan
   `CLAUDE_CODE_OAUTH_TOKEN`) secret'ını ekleyin.

## Proje ekleme

`projects.json` dosyasına depoyu ekleyip `main`'e push'layın:

```json
{
  "central": { "repo": "ilaydacamgoz6-sys/ai-otonom", "ref": "main" },
  "defaults": {
    "mention": true,
    "review": true,
    "maintenance": false,
    "maintenanceCron": "0 6 * * 1",
    "language": "Türkçe"
  },
  "projects": [
    "ilaydacamgoz6-sys/web-sitesi",
    { "repo": "ilaydacamgoz6-sys/api", "maintenance": true }
  ]
}
```

`sync.yml` çalışır ve her projede `otonom/sync` dalından bir PR açar. PR'ı birleştirdiğinizde
proje otonom hale gelir. Bir özelliği `false` yaparsanız ilgili workflow dosyası bir sonraki
senkronizasyonda kaldırılır. Senkronizasyon her gün de çalışır; proje güncelse hiçbir şey yapmaz.

> `otonom/sync` dalı her senkronizasyonda yeniden oluşturulur; bu dala elle commit atmayın.

## Elle çalıştırma

```bash
npm install
export OTONOM_GH_TOKEN=github_pat_...
npm run onboard -- --dry-run                           # yalnızca göster
npm run onboard -- --repo ilaydacamgoz6-sys/api        # tek proje
npm run onboard                                        # hepsi
```

Node.js 22.18+ gerekir (TypeScript doğrudan çalıştırılır, derleme adımı yok).

## Geliştirme

```bash
npm run check   # typecheck + testler
```
