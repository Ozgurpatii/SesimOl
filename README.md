# Sesim Ol

Türkçe, çevrimdışı kullanılabilen React Native + Expo iletişim uygulaması. Ana ekranda fotoğraflı veya simgeli büyük kartlara dokunulduğunda telefon seçilen cümleyi okur ya da bakıcının kaydettiği sesi çalar.

## Başlangıç

```powershell
cd outputs/sesim-ol
pnpm install
pnpm start
```

Node.js 22.13 veya üstü ve pnpm kurulu olmalıdır. Telefon ve bilgisayar aynı Wi-Fi ağına bağlıyken en güncel Expo Go uygulamasını açıp terminaldeki QR kodu okutun. Uygulama SDK 57 kullanır; Expo Go yalnızca güncel SDK sürümünü desteklediğinden telefonunuzdaki Expo Go da güncel olmalıdır. Android emülatörü için `pnpm android`; iOS simülatörü için macOS üzerinde `pnpm ios` komutunu kullanın.

İlk bakıcı PIN’i `2468`’dir. Uygulamayı ilk çalıştırdıktan sonra **Bakıcı → Ayarlar → PIN’i değiştir** yoluyla değiştirin. Normal iletişim ekranı PIN istemez.

## Özellikler

- Başlangıçta 12 Türkçe iletişim butonu ve altı temel kategori.
- Galeriden fotoğraf seçme, kamera ile fotoğraf çekme ve hazır simgeler.
- Telefon mikrofonuyla kayıt, kaydı dinleme ve karta atama.
- Metinden Türkçe sese dönüşüm; ses hızı, tema, yüksek kontrast, kart boyutu ve 2/3/4 sütun ayarları.
- Butonları düzenleme, çoğaltma, sıralama ve onayla silme; kategori oluşturma, düzenleme ve silme.
- SQLite veritabanı ve uygulamanın belge alanındaki kalıcı medya dosyaları. Ses, fotoğraf veya buton bilgisi bir sunucuya gönderilmez.
- Uygulama arka plana geçtiğinde ses çalma ve kayıt güvenli biçimde durdurulur.
- Ekran okuyucu etiketleri, büyük dokunma alanları ve yatay/dikey ekran desteği.

İlk sürümde verileri dışa/içe aktaran yedek dosyası bulunmuyor.

Metinden sese, cihazın kendi konuşma motorunu kullanır. Türkçe ses paketi telefonda yüklü değilse TTS duyulmayabilir; cihazın dil ve konuşma ayarlarından Türkçe ses ekleyin. Kaydedilmiş sesler çevrimdışı çalışır. iOS’ta TTS sesi için cihaz sessiz modda olmamalıdır. Uygulama silinirse yerel kayıtlar ve butonlar da silinir.

## Android APK

Expo hesabı ve EAS CLI ile yüklenebilir test APK’sı oluşturun. İlk kullanımda projeyi EAS’e bağlayın:

```powershell
npx eas-cli@latest login
npx eas-cli@latest build:configure
npx eas-cli@latest build --platform android --profile preview
```

EAS derleme bağlantısı oluşturulduktan sonra APK’yı telefona indirip kurabilirsiniz. Uygulamayı mağazaya göndermek için `production` profiliyle AAB oluşturun:

```powershell
npx eas-cli@latest build --platform android --profile production
```

Bu klasörde üretilmiş bir APK yoktur; APK derlemesi EAS hesabı gerektirir.

## Kontrol

```powershell
pnpm typecheck
pnpm doctor
```

`pnpm typecheck` TypeScript kaynaklarını denetler; `pnpm doctor` Expo SDK ve bağımlılık uyumunu kontrol eder. Mikrofon, kamera, cihaz TTS motoru ve uygulama yeniden açılışındaki dosya kalıcılığı gerçek telefonda doğrulanmalıdır. Bu kaynak paketi kendi başına bir yayınlanmış APK içermez.
