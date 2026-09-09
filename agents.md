# Linter — AGENTS.md

## 1. Projenin Amacı

Linter, Linear için geliştirilen bağımsız, terminal-native bir CLI + TUI istemcisidir.

Kullanıcı herhangi bir uyumlu terminal içerisinde:

```bash
linter
```

komutunu çalıştırdığında full-screen TUI açılmalıdır.

Aynı executable script edilebilir CLI davranışını da desteklemelidir:

```bash
linter issues
linter issue ENG-123
linter issue ENG-123 --json
linter create
linter projects
linter cycles
```

Linter herhangi bir terminal emulatorüne veya geliştirme ortamına bağımlı değildir.

Luvus, Ghostty, Kitty, WezTerm, iTerm2, tmux ve benzeri araçlar yalnızca Linter'ın çalışabileceği ortamlardır.

Luvus API, plugin sistemi veya başka bir terminal-specific integration Linter core mimarisine eklenmemelidir.

---

## 2. Ana Hedefler

Linter'ın temel hedefleri:

1. Linear günlük issue-management workflow'unu terminale taşımak.
2. List ve Kanban görünümlerini desteklemek.
3. Vim-first keyboard navigation sunmak.
4. Mouse zorunluluğunu kaldırmak.
5. Hızlı startup ve local-first görünüm sağlamak.
6. CLI üzerinden script ve coding-agent kullanımına izin vermek.
7. Linear API ile güvenilir ve resmi API uyumlu çalışmak.
8. Tek standalone executable olarak dağıtılabilmek.
9. Linux ve macOS üzerinde çalışmak.
10. UI, Linear API ve storage katmanlarını birbirinden bağımsız tutmak.

---

## 3. Teknoloji Yığını

Zorunlu temel stack:

- TypeScript
- Bun
- Effect
- @effect/cli
- @effect/platform
- @effect/platform-bun
- OpenTUI
- @opentui/react
- @opentui/keymap
- React
- @linear/sdk
- Linear GraphQL API
- bun:sqlite
- bun:test
- drizzle-orm

Yeni temel framework veya state-management dependency eklemeden önce gerçekten gerekli olduğundan emin ol.

Zustand, Redux, MobX vb. yalnızca açık ve kanıtlanmış bir ihtiyaç oluşursa eklenebilir.

---

## 4. Repository Mimarisi

Beklenen monorepo:

```text
apps/
  linter/

packages/
  core/
  linear/
  storage/
  auth/
  tui/
  cli/
  config/
  testkit/
```

Dependency yönü:

```text
apps/linter
     |
  cli / tui
     |
    core
   / |  \
linear auth storage
```

Kurallar:

- `core` @linear/sdk import etmemeli.
- `core` OpenTUI import etmemeli.
- `core` bun:sqlite import etmemeli.
- `tui` doğrudan Linear API çağırmamalı.
- `cli` doğrudan Linear SDK çağırmamalı.
- `linear` OpenTUI hakkında hiçbir şey bilmemeli.
- `storage` UI hakkında hiçbir şey bilmemeli.

Domain merkezde kalmalıdır.

---

## 5. Domain Model

Linter kendi domain modellerini kullanmalıdır.

Örnek:

```text
Issue
Team
User
Project
Cycle
Label
WorkflowState
Comment
```

Linear SDK modellerini doğrudan TUI veya core katmanına aktarma.

Daima:

```text
Linear API
   ↓
Linear SDK / GraphQL types
   ↓
mapper
   ↓
Linter domain model
```

kullan.

Amaç, Linear SDK veya GraphQL schema değişikliklerinin uygulamanın tamamına yayılmasını engellemektir.

---

## 6. Effect Kullanımı

Side-effect yapan işlemler Effect service olarak modellenmelidir.

Temel servisler:

```text
LinearService
AuthService
IssueRepository
ProjectRepository
CacheService
ConfigService
SecretStore
EditorService
BrowserService
ClipboardService
SyncService
```

Her production implementation için mümkün olduğunda test implementation oluştur.

Örnek:

```text
LinearServiceLive
LinearServiceTest

AuthServiceLive
AuthServiceTest

IssueRepositoryLive
IssueRepositoryTest
```

UI içerisinde doğrudan:

```text
fetch(...)
Bun.file(...)
new Database(...)
new LinearClient(...)
```

çağrıları yapılmamalıdır.

Bunlar infrastructure/service layer'da bulunmalıdır.

Expected failure'larda mümkün olduğunca typed error kullan.

Unknown exception'ları domain error'a dönüştür.

---

## 7. Linear API — ZORUNLU KURALLAR

Linear entegrasyonu projenin en kritik bölümüdür.

Hiçbir Linear field, mutation, input type, relation veya API davranışı tahmin edilmemelidir.

Bir Linear özelliği implemente edilmeden önce:

1. Güncel resmi Linear developer documentation kontrol edilmeli.
2. Mümkünse `@linear/sdk` type'ları kontrol edilmeli.
3. Gerekirse GraphQL introspection/schema kontrol edilmeli.
4. Kullanılan field ve mutation'ın gerçekten mevcut olduğu doğrulanmalı.

Resmi API endpoint:

```text
https://api.linear.app/graphql
```

Basit operations ve mutations için öncelik:

```text
@linear/sdk
```

Kompleks ve ekran-özel optimize edilmiş sorgular için:

```text
GraphQL
```

kullanılabilir.

Raw GraphQL yalnızca anlamlı fayda sağladığında kullanılmalıdır.

---

## 8. GraphQL Error Handling

HTTP 200 success anlamına gelmeyebilir.

Her GraphQL response:

```text
data
errors
```

açısından kontrol edilmelidir.

Partial-success senaryoları doğru işlenmelidir.

Network error, GraphQL error, authentication error, permission error ve rate-limit error birbirinden ayrılmalıdır.

Kullanıcıya raw stack trace gösterilmemelidir.

Debug log'larda gerekli teknik bilgi korunabilir.

---

## 9. Pagination

Büyük koleksiyonların tamamını tek query ile çekme.

Linear cursor pagination kullanılmalıdır.

Issue listelerinde kontrollü sayfa büyüklüğü kullan.

UI:

```text
initial page
   ↓
render
   ↓
next page gerektiğinde fetch
```

mantığıyla çalışabilir.

Board/list ekranlarında yalnızca gerçekten ihtiyaç duyulan field'ları request et.

---

## 10. Filtering

Mümkün olan filtreleri client tarafında yapmak yerine Linear GraphQL filter sistemine gönder.

Örnek filtreler:

- team
- assignee
- workflow state
- project
- cycle
- priority
- updatedAt
- labels

Bütün workspace'i indirip ardından filtreleme yapma.

Local cache üzerindeki hızlı görünüm filtreleri bunun istisnasıdır.

---

## 11. Rate Limits

Linear API agresif şekilde poll edilmemelidir.

KESİNLİKLE YAPMA:

```text
for each issue:
    poll issue
```

Bunun yerine:

```text
startup sync
incremental updatedAt sync
manual refresh
controlled background refresh
```

kullan.

Rate-limit response header'ları mümkün olduğunda gözlemlenmelidir.

`RATELIMITED` GraphQL error kodu doğru şekilde ele alınmalıdır.

Retry yapılacaksa:

- sınırlı retry
- exponential backoff
- jitter

uygulanmalıdır.

Mutation'ın retry edilmesinin duplicate side-effect oluşturmayacağından emin olunmadan otomatik retry yapılmamalıdır.

---

## 12. Authentication

Production authentication:

```text
OAuth 2.0 Authorization Code
+ PKCE S256
```

olmalıdır.

Login flow:

```text
linter auth login
      ↓
local callback server
      ↓
browser
      ↓
Linear authorization
      ↓
localhost callback
      ↓
token exchange
      ↓
secure token storage
```

OAuth `state` değeri cryptographically secure random olmalı ve callback sırasında doğrulanmalıdır.

PKCE:

```text
code_verifier
SHA256
code_challenge
S256
```

kullanmalıdır.

Client secret standalone binary içerisinde hardcode edilmemelidir.

Access token expiration ve refresh token rotation desteklenmelidir.

Refresh token kaybolursa kullanıcı yeniden login yapmalıdır.

---

## 13. Secret Yönetimi

Access token ve refresh token plaintext config içerisinde saklanmamalıdır.

`SecretStore` abstraction kullan.

İlk implementation Bun secrets olabilir.

Service adı:

```text
dev.linter.cli
```

gibi Linter'a özgü olmalıdır.

Config dosyasında yalnızca non-sensitive ayarlar tutulabilir:

```text
default workspace
default team
default view
theme
editor
keybindings
refresh preferences
```

---

## 14. SQLite

SQLite yalnızca local cache ve local application state içindir.

Source of truth Linear'dır.

Database minimum olarak:

```text
workspaces
teams
users
workflow_states
issues
projects
cycles
labels
issue_labels
comments
sync_state
```

tablolarını destekleyebilir.

Migration sistemi versioned olmalıdır:

```text
001_initial.sql
002_issue_relations.sql
...
```

Database startup'ta:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

uygulanmalıdır.

SQLite cache bozulduğunda kullanıcının Linear verisini kaybetmesine neden olmamalıdır.

Cache silinip yeniden oluşturulabilir olmalıdır.

---

## 15. Sync Modeli

Uygulama açıldığında network beklenmemeli.

İdeal akış:

```text
launch
   ↓
cached data load
   ↓
render TUI
   ↓
background Linear sync
   ↓
repository update
   ↓
UI refresh
```

No-cache first-run bunun doğal istisnasıdır.

Sync state en az:

```text
lastSuccessfulSync
workspaceId
updatedAtCursor/threshold
```

bilgilerini tutmalıdır.

---

## 16. Optimistic Mutations

Interactive mutation'larda kullanıcı deneyimi hızlı olmalıdır.

Örneğin issue status değişimi:

```text
keypress
   ↓
local optimistic update
   ↓
render
   ↓
Linear mutation
   ├─ success → commit
   └─ error → rollback + notification
```

Rollback güvenilir olmalıdır.

Create veya destructive operations'da optimistic behavior'ın güvenli olduğundan emin ol.

---

## 17. TUI Prensipleri

Linter mouse-first değildir.

Keyboard-first ve Vim-first olmalıdır.

Temel navigation:

```text
j        aşağı
k        yukarı
h        sol
l        sağ

gg       ilk
G        son

Enter    aç
Esc      geri

/        arama
f        filtre
:        command palette
?        yardım
```

Issue:

```text
n        yeni issue
e        düzenle
c        yorum
s        status
a        assignee
p        priority
y        identifier kopyala
o        Linear web'de aç
```

View:

```text
b        list / board geçişi
```

Kanban:

```text
h/l      kolon değiştir
j/k      issue seç
H/L      issue status'unu sola/sağa taşı
```

Keybinding logic component'lere dağılmamalıdır.

Named commands kullan:

```text
navigation.down
navigation.up
issue.open
issue.edit
issue.changeStatus
board.moveLeft
board.moveRight
app.search
```

Keymap config sonradan kullanıcı tarafından override edilebilir olmalıdır.

---

## 18. Responsive Terminal UI

TUI tek bir terminal boyutuna göre tasarlanmamalıdır.

Minimum terminal boyutu tanımla.

Geniş ekran:

```text
sidebar | issue list | preview
```

Orta ekran:

```text
issue list | preview
```

Dar ekran:

```text
single-pane navigation
```

Terminal resize event'leri desteklenmelidir.

Layout overflow veya broken rendering kabul edilmez.

---

## 19. Kanban

Kanban ayrı bir Linear API değildir.

Issue'ları WorkflowState'e göre grupla.

Her team'in workflow state yapısının farklı olabileceğini varsay.

Hardcoded:

```text
Backlog
Todo
In Progress
Done
```

ID veya isimlerine güvenme.

Linear'dan workflow states getir ve state type/order bilgisine göre render et.

Status değişikliklerini Linear mutation üzerinden gerçekleştir.

---

## 20. CLI ve TUI Aynı Use Case'leri Kullanmalı

Şunu yapma:

```text
CLI implementation A
TUI implementation B
```

Şunu yap:

```text
           Use Cases
          /         \
       CLI           TUI
```

Örneğin:

```text
GetIssue
ListIssues
CreateIssue
UpdateIssue
ChangeIssueStatus
AddComment
```

hem CLI hem TUI tarafından kullanılmalıdır.

---

## 21. JSON Output

Agent ve shell entegrasyonu first-class feature'dır.

CLI komutları uygun olduğunda:

```text
--json
```

desteklemelidir.

Örneğin:

```bash
linter issue ENG-123 --json
```

stdout yalnızca valid JSON üretmelidir.

Log, spinner veya diagnostics JSON stdout'a karışmamalıdır.

Diagnostics stderr'e yazılmalıdır.

Bu davranış piping için önemlidir:

```bash
linter issues --json | jq ...
```

---

## 22. External Editor

Uzun issue description ve comment editing için `$EDITOR` desteklenmelidir.

Öncelik:

```text
LINTER_EDITOR
EDITOR
VISUAL
```

Editor çağrısı shell injection'a izin vermemelidir.

Temp file lifecycle güvenli şekilde yönetilmelidir.

Kullanıcı save etmeden çıkarsa mutation yapılmamalıdır.

---

## 23. Command Naming

Public executable:

```text
linter
```

olmalıdır.

Internal workspace package isimleri:

```text
@linter/core
@linter/linear
@linter/storage
@linter/auth
@linter/tui
@linter/cli
@linter/config
@linter/testkit
```

şeklinde kullanılabilir.

---

## 24. Testing

Yeni özellik yalnızca UI'da çalışıyor görünmesine göre tamamlanmış sayılmaz.

Minimum test yaklaşımı:

Domain:

- unit tests

Linear mapper:

- fixture tests

Linear API:

- mocked contract tests

Storage:

- temporary SQLite database tests

CLI:

- command output tests

TUI:

- keyboard interaction tests
- render tests
- resize tests

Özellikle şunlar test edilmelidir:

- status mutation rollback
- expired OAuth token refresh
- GraphQL partial error
- rate limit
- pagination
- empty state
- permission error
- deleted issue
- network offline

Gerçek Linear API üzerinde çalışan testleri normal unit test suite'e bağlama.

---

## 25. Kod Kalitesi

TypeScript strict mode zorunludur.

Kaçınılması gerekenler:

```text
any
as unknown as ...
@ts-ignore
non-null assertion (!)
```

Bunlar yalnızca kaçınılmaz interoperability noktalarında ve açıklamayla kullanılabilir.

Public functions açık ve dar contract'lara sahip olmalıdır.

Kod tekrarını azalt ancak erken abstraction oluşturma.

Tek kullanımlık soyutlamalar üretme.

---

## 26. Performans

Linter hızlı hissettirmelidir.

Öncelikler:

1. Cached initial render
2. Minimum GraphQL payload
3. Controlled pagination
4. Prepared SQLite statements
5. Minimum React rerender
6. Background network work

TUI render döngüsünde synchronous ağır hesaplama yapma.

---

## 27. Logging

Interactive TUI sırasında stdout'a normal log basma.

Aksi halde terminal renderer bozulabilir.

Log sistemi:

```text
~/.local/state/linter/linter.log
```

gibi ayrı bir dosyaya yönlendirilebilir.

Debug mode:

```bash
linter --debug
```

desteklenebilir.

Token, OAuth code, refresh token veya secret loglama.

ASLA.

---

## 28. Error UX

Kullanıcıya teknik stack trace yerine actionable hata göster.

Örnek:

```text
Linear bağlantısı kurulamadı.
Son cache gösteriliyor.
```

veya:

```text
Oturumun süresi doldu.
`linter auth login` çalıştırın.
```

Interactive UI hata nedeniyle gereksiz şekilde kapanmamalıdır.

Fatal error yoksa TUI çalışmaya devam etmelidir.

---

## 29. Feature Geliştirme Prosedürü

Yeni özellik geliştirirken her zaman şu sırayı kullan:

1. Gereksinimi tanımla.
2. Linear API capability'sini resmi kaynaktan doğrula.
3. Domain model değişikliği gerekiyor mu belirle.
4. Use case oluştur.
5. Service interface gerekiyorsa oluştur.
6. Linear adapter implemente et.
7. Storage değişikliği gerekiyorsa migration yaz.
8. Testleri yaz.
9. CLI gerekiyorsa CLI adapter ekle.
10. TUI gerekiyorsa TUI adapter ekle.
11. Keyboard command ekle.
12. Error states test et.
13. Offline/cache behavior test et.
14. Typecheck çalıştır.
15. Test suite çalıştır.

Bir UI component'inden başlayıp aşağı doğru architecture oluşturma.

Domain/use-case tarafından dışarı doğru ilerle.

---

## 30. Feature Roadmap

### Phase 1 — Foundation

- Bun monorepo
- TypeScript
- Effect layers
- application bootstrap
- config paths
- logging
- test infrastructure

### Phase 2 — Authentication

- OAuth2
- PKCE
- localhost callback
- secure token store
- refresh token
- auth commands

### Phase 3 — Linear Read Model

- viewer
- workspaces
- teams
- workflow states
- issues
- single issue
- projects
- cycles

### Phase 4 — Initial TUI

- renderer
- layout
- issue list
- issue details
- Vim navigation
- help overlay

### Phase 5 — Mutations

- create issue
- update issue
- status
- priority
- assignee
- labels
- comments

### Phase 6 — Search & Filtering

- search
- team
- state
- project
- cycle
- assignee
- priority
- label filters

### Phase 7 — Kanban

- dynamic workflow columns
- navigation
- move issue
- optimistic state update

### Phase 8 — Storage

- SQLite
- migrations
- cached initial render
- incremental sync
- offline read support

### Phase 9 — CLI

- issues
- issue
- create
- update
- projects
- cycles
- --json output

### Phase 10 — Terminal-native Features

- $EDITOR
- clipboard
- browser open
- customizable keymaps
- themes
- command palette

### Phase 11 — Production Hardening

- rate limit handling
- retry policies
- auth expiry
- error recovery
- terminal resize
- crash cleanup
- performance profiling

### Phase 12 — Distribution

- standalone Bun executable
- Linux x64/arm64
- macOS x64/arm64
- checksums
- release automation

---

## 31. Definition of Done

Bir feature yalnızca aşağıdakiler tamamlandığında bitmiş kabul edilir:

- Linear API davranışı doğrulandı.
- Domain boundary korunuyor.
- Type-safe.
- Error handling var.
- Loading state var.
- Empty state var.
- Permission failure ele alınıyor.
- Keyboard ile tamamen kullanılabiliyor.
- Testleri var.
- `bun test` başarılı.
- Typecheck başarılı.
- TUI düzgün cleanup yapıyor.
- Existing CLI/TUI behavior bozulmuyor.

---

## 32. Agent İçin Kesin Yasaklar

Aşağıdakileri yapma:

- Linear API field'ı uydurma.
- Linear mutation ismi tahmin etme.
- Deprecated Linear API'yi bilinçsiz kullanma.
- Tüm issue'ları çekip client-side filtreleme.
- Her issue için polling yapma.
- OAuth token'ını plaintext dosyaya yazma.
- UI component'inden direkt Linear API çağırma.
- UI component'inden direkt SQLite çağırma.
- `any` ile type sorunlarını gizleme.
- Luvus-specific dependency ekleme.
- hardcoded workflow status ID/name kullanma.
- production'da Personal API Key'i ana auth yöntemi yapma.
- token veya secret loglama.
- TUI stdout'una debug log basma.
- network cevabı gelene kadar gereksiz UI bloklama.

---

## 33. Karar Veremediğinde

Öncelik sırası:

1. Doğruluk
2. Linear API uyumu
3. Basit mimari
4. Terminal UX
5. Type safety
6. Performans
7. Developer convenience

Bir özellik Linear API tarafından desteklenmiyorsa workaround'u destekleniyormuş gibi göstermeyin.

Bunu açıkça belirtin ve mümkün olan en yakın resmi API çözümünü kullanın.

---

## 34. Son Prensip

Linter bir "Linear web uygulamasını terminalde taklit etme" projesi değildir.

Linter:

```text
fast
keyboard-first
scriptable
composable
local-cache backed
terminal-native
```

bir Linear client olmalıdır.

Her tasarım kararında şu soruyu sor:

> Bu özellik Linear'ı terminalde daha doğal ve daha hızlı kullanmayı sağlıyor mu?

Cevap hayır ise özellik tekrar değerlendirilmelidir.
