# Lineater Standalone Dağıtım Sistemi

Bu belge Lineater'ın Bun veya Node.js kurulumu gerektirmeden Linux ve macOS kullanıcılarına nasıl dağıtıldığını, güvenlik kontrollerini ve yeni sürüm yayınlama prosedürünü açıklar.

## Desteklenen platformlar

Her sürüm aşağıdaki dört arşivi üretir:

| İşletim sistemi | Mimari | GitHub Release dosyası |
| --- | --- | --- |
| Linux | x64 | `lineater-linux-x64.tar.gz` |
| Linux | arm64 | `lineater-linux-arm64.tar.gz` |
| macOS | Intel x64 | `lineater-darwin-x64.tar.gz` |
| macOS | Apple Silicon arm64 | `lineater-darwin-arm64.tar.gz` |

x64 executable'lar eski işlemcilerle daha geniş uyumluluk için Bun'ın `baseline` hedefiyle derlenir. Her arşiv, çalışma zamanını içinde taşıyan tek bir `lineater` executable'ı içerir.

## Kullanıcı kurulumu

Önerilen kurulum komutu:

```sh
curl -fsSL https://lineater.pages.dev/install | sh
```

Installer:

1. `uname` ile Linux/macOS ve x64/arm64 tespiti yapar.
2. GitHub'daki en güncel sürümden doğru arşivi indirir.
3. Aynı release içindeki `checksums.txt` dosyasını indirir.
4. Arşivin SHA-256 değerini yayınlanan değerle karşılaştırır.
5. Executable'ı geçici dizinde `lineater --version` ile smoke-test eder.
6. Binary'yi atomik olarak `~/.local/bin/lineater` konumuna taşır.
7. Kurulum dizini `PATH` içinde değilse kullanıcıya eklemesi gereken satırı gösterir.

Installer `sudo` çalıştırmaz ve sistem dizinlerini kendiliğinden değiştirmez.

### Belirli bir sürümü kurmak

```sh
curl -fsSL https://lineater.pages.dev/install \
  | LINEATER_VERSION=0.1.0 sh
```

`LINEATER_VERSION=v0.1.0` biçimi de desteklenir.

### Farklı bir dizine kurmak

```sh
curl -fsSL https://lineater.pages.dev/install \
  | LINEATER_INSTALL_DIR="$HOME/bin" sh
```

Desteklenen kullanıcı değişkenleri:

| Değişken | Varsayılan | Amaç |
| --- | --- | --- |
| `LINEATER_VERSION` | `latest` | Kurulacak release sürümü |
| `LINEATER_INSTALL_DIR` | `~/.local/bin` | Binary hedef dizini |
| `LINEATER_REPOSITORY` | `benbugraer/lineater` | GitHub repository override |

`LINEATER_DOWNLOAD_BASE`, `LINEATER_OS` ve `LINEATER_ARCH` yalnızca installer entegrasyon testi ve kontrollü mirror senaryoları için sunulan dahili override'lardır.

### Kaldırma

Varsayılan kurulum için:

```sh
rm "$HOME/.local/bin/lineater"
```

Lineater'ın kullanıcı verileri executable'dan bağımsızdır. Cache'i de silmek isteyen kullanıcı bunu ayrıca yapmalıdır; uninstaller'ın kullanıcı verisini otomatik silmemesi bilinçli bir güvenlik tercihidir.

## Release artifact üretimi

Yerelde dört platformu derlemek için:

```sh
bun install --cpu="*" --os="*"
bun run typecheck
bun test
bun run test:installer
LINEATER_RELEASE_LINEAR_CLIENT_ID="$LINEATER_LINEAR_CLIENT_ID" bun run build:release
```

Yalnızca belirli hedefleri üretmek mümkündür:

```sh
./scripts/build-release.sh linux-x64 darwin-arm64
```

Çıktılar git tarafından izlenmeyen `release/` dizinine yazılır. Script arşivlerden sonra deterministik isimlere sahip bir `checksums.txt` üretir.

Release sürümünü doğrulamak için:

```sh
LINEATER_VERSION=0.1.0 \
LINEATER_RELEASE_LINEAR_CLIENT_ID="$LINEATER_LINEAR_CLIENT_ID" \
./scripts/build-release.sh
```

Verilen sürüm `apps/lineater/package.json` içindeki sürümle eşleşmezse build bilinçli olarak durur. CLI'daki `--version` çıktısı da aynı package dosyasından gelir; böylece uygulama, tag ve artifact sürümleri arasında tek doğruluk kaynağı korunur.

`LINEATER_RELEASE_LINEAR_CLIENT_ID`, Linear'da kayıtlı public OAuth uygulamasının gizli olmayan client ID değeridir. Release build bu değeri binary içine gömer; böylece curl ile kurulumdan sonra kullanıcı ayrıca config veya environment variable hazırlamadan TUI içinden giriş yapabilir. Değer GitHub repository variable olarak `LINEATER_LINEAR_CLIENT_ID` adıyla tutulur. Dokümantasyon placeholder'ları (`your-public-client-id`, `GERCEK_LINEAR_CLIENT_ID` vb.) reddedilir. OAuth uygulaması diğer Linear workspace kullanıcılarının yetkilendirmesine açık olmalıdır; aksi halde curl ile kuran kişiler Linear'da client bulunamadı hatası görür. Client secret hiçbir aşamada kullanılmaz veya gömülmez.

## Otomatik GitHub Release akışı

`.github/workflows/release.yml`, `v*` biçimindeki tag push edildiğinde çalışır:

1. Repository checkout edilir ve sabitlenmiş Bun sürümü kurulur.
2. Lockfile değiştirilmeden `bun install --frozen-lockfile --cpu="*" --os="*"` çalışır. Bu override, OpenTUI'ın dört hedefe ait native optional paketlerinin cross-compile sırasında bulunmasını sağlar.
3. Tag sürümü ile app package sürümü karşılaştırılır.
4. Typecheck, unit testler ve gerçek installer entegrasyon testi çalıştırılır.
5. Dört standalone executable cross-compile edilir.
6. Linux x64 arşivi açılarak `--version` smoke testi yapılır.
7. Artifact'lar için GitHub build provenance attestation oluşturulur.
8. Arşivler, `checksums.txt` ve `CHANGELOG.md` notları GitHub Release'e eklenir.

Workflow'a `contents: write`, `id-token: write` ve `attestations: write` dışında repository yetkisi verilmez.

## Yeni sürüm yayınlama prosedürü

Örnek olarak `0.1.0` yayınlamak için:

1. `apps/lineater/package.json` içindeki `version` değerini `0.1.0` yap.
2. Gerekirse kök `package.json` sürümünü de proje metadata'sı için aynı değere getir.
3. Aşağıdaki kontrolleri çalıştır:

   ```sh
   bun install
   bun run typecheck
   bun test
   bun run test:installer
   bun run build
   ./dist/lineater --version
   ```

4. Değişiklikleri commit edip ana branch'e gönder.
5. Aynı sürümle annotated tag oluşturup gönder:

   ```sh
   git tag -a v0.1.0 -m "Lineater v0.1.0"
   git push origin v0.1.0
   ```

6. GitHub Actions'taki **Release standalone binaries** workflow'unun tamamlandığını doğrula.
7. Fresh-install OAuth smoke testinin paketlenmiş client ID, PKCE S256, state, exact callback ve scope kontrollerini geçtiğini doğrula.
8. GitHub Release sayfasında dört arşiv, `checksums.txt` ve provenance bilgisinin bulunduğunu kontrol et.
9. Temiz bir Linux veya macOS ortamında web sitesindeki `curl` komutunu çalıştırıp son kullanıcı kurulumunu ve tarayıcı login başlangıcını doğrula.

Tag ile package sürümü eşleşmezse workflow release oluşturmadan hata verir. Hatalı bir release'i düzeltmek için mevcut tag'i sessizce değiştirmek yerine package sürümünü artırıp yeni bir patch release yayınlamak önerilir.

## Dosya sorumlulukları

- `scripts/install.sh`: Platform tespiti, güvenli indirme, checksum doğrulama ve kurulum.
- `scripts/install.test.sh`: Lokal `file://` release fixture'ı ile uçtan uca installer testi.
- `scripts/build-release.sh`: Dört Bun hedefinin compile, archive ve checksum üretimi.
- `.github/workflows/release.yml`: Tag kontrollü doğrulama, provenance ve GitHub Release yayını.
- `apps/lineater/src/main.ts`: CLI sürümünü app package metadata'sından okur.
- `apps/web/src/pages/index.mdx`: Kullanıcıya runtime gerektirmeyen gerçek kurulum komutunu gösterir.

## Bilinen kapsam sınırları ve sonraki kanallar

Bu aşamada resmi destek Linux ve macOS içindir; `agents.md` içindeki standalone dağıtım hedefiyle uyumludur. Windows için binary hedefi ve PowerShell installer ayrı olarak tasarlanmalıdır. Homebrew, Scoop veya npm daha sonra ikincil dağıtım kanalları olabilir; canonical artifact her durumda GitHub Release içindeki standalone binary olmalıdır.
