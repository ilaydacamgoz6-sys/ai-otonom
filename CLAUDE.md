# ai-otonom

Diğer projeleri Claude ile otonom hale getiren merkezi depo. Ayrıntılar için README.md'ye bakın.

## Komutlar

- Kurulum: `npm install`
- Kontrol (typecheck + test): `npm run check`
- Senkronizasyon önizlemesi: `npm run onboard -- --dry-run` (`OTONOM_GH_TOKEN` gerekir)

## Kurallar

- `src/` Node 22'nin yerleşik TypeScript desteğiyle doğrudan çalışır: yalnızca silinebilir
  sözdizimi kullan (enum, namespace, parametre özelliği yok), import'larda `.ts` uzantısı yaz.
- Çalışma zamanı bağımlılığı ekleme; GitHub API'si için `src/github.ts`'teki `fetch` istemcisini kullan.
- `.github/workflows/claude-*.yml` dosyaları tüm projeleri etkiler; değiştirirken geriye dönük
  uyumluluğu koru (yeni `inputs` için varsayılan değer ver).
- `templates/` içinde yeni bir değişken kullanırsan `src/plan.ts`'teki `vars`'a ekle.
- Kullanıcıya dönük metinler (log, PR açıklaması, prompt) Türkçe.
