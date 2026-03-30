---
title: "Eu Patchei o Flashrom no Celular Para Recuperar uma Placa-Mãe Morta"
date: 2026-03-30
lastmod: 2026-03-30
draft: false
author: "enrell"
description: "Meu PC morreu. Eu 'brickei' a placa de substituição. E quando não tinha nenhum computador para consertá-la, modifiquei ferramentas de firmware open-source para rodar no Android. Esta é a história de como recuperei uma placa-mãe com nada além de um celular e um programador CH341A."

tags: ["linux", "android", "hardware", "firmware", "open-source", "flashrom", "embarcado", "c"]
categories: ["Hardware", "Open Source"]

toc:
  enable: true
  auto: true

math:
  enable: true

share:
  enable: true

comment:
  enable: true
---

Era uma tarde de sábado. Apertei o botão de ligar do meu PC e... nada. As ventoinhas giraram por um segundo, os LEDs piscaram e ele morreu. Tentou de novo. Um segundo, morto. Um segundo, morto. Um loop infinito de boot sem saída de vídeo, sem códigos de erro, nada.

O que se seguiu foi uma odisseia de uma semana com diagnósticos, palpites errados, uma placa-mãe nova, uma BIOS brickada e — quando todos os computadores da minha casa estavam mortos — uma sessão de código às 23h no meu celular para patchear uma ferramenta open-source que nunca foi feita para rodar no Android.

Eu não tinha multímetro, nem placa POST, nem visor de diagnóstico. Apenas os meus olhos e muita determinação.

## O Diagnóstico

Meu primeiro suspeito foi o processador. O LED da Ethernet apagado geralmente significa que não há POST, e sem POST, o processador provavelmente não está inicializando. Minha placa era uma X99 P4 — o modelo de X99 mais básico que se pode encontrar. Com um Xeon E5-2670v3, ela vinha funcionando bem por meses.

Mas "funcionar bem por meses" em uma placa X99 barata com um Xeon de 12 núcleos é pedir demais do VRM (Módulo Regulador de Tensão).

Meu segundo suspeito foi a fonte. Se ela não entrega corrente suficiente na linha do processador, a placa liga, mas nunca chega ao POST. As ventoinhas giram, os LEDs acendem, mas o processador "passa fome".

Meu terceiro suspeito foi a própria placa-mãe. Placas X99 de baixo custo têm projetos de VRM modestos. Um chip Haswell-EP de 12 núcleos puxando 120W de TDP por VRMs de 4 fases? Era apenas uma questão de *quando*, não de *se*.

A resposta acabou sendo dois dos três: **tanto a fonte quanto a placa-mãe estavam mortas.** O VRM desistiu e a fonte já não estava entregando uma corrente limpa.

## Hardware Novo, Esperança Nova

Comprei peças de reposição:

- **Fonte:** Husky Sledger — sólida, confiável e com folga suficiente.
- **Placa-mãe:** MR9A-H — um degrau acima da P4.
- **Processador:** Xeon E5-2640v3 — por precaução, caso o antigo também estivesse danificado.

Montei tudo, apertei o power e... deu boot. Tela da BIOS apareceu. O Memtest passou. Instalei o SO e comecei a usar.

Por cerca de 30 minutos.

## O Incidente do Turbo Boost

Foi aqui que cometi o meu primeiro erro.

O E5-2640v3 tem um clock base de 2.6 GHz e turbo de até 3.4 GHz. Mas nessas placas X99 chinesas, o turbo boost geralmente vem bloqueado por padrão. Em jogos, especialmente com a minha RX 6600, esse clock extra faz diferença na estabilidade da taxa de quadros.

Pensei: *"Vou gravar uma BIOS modificada com turbo unlock. Fácil. Já fiz isso antes."*

Eu tinha um backup da BIOS antiga — a da X99 P4 morta. No calor do momento, peguei o arquivo errado. Em vez de gravar a BIOS da MR9A-H, gravei a **BIOS da P4 na placa MR9A-H.**

A gravação terminou. Reiniciei.

Morto. De novo. O mesmo loop de 1 segundo.

Eu tinha acabado de inutilizar minha segunda placa-mãe em uma semana.

## O CH341A Chega

A única forma de recuperar uma placa com BIOS brickada é regravando o chip externamente. Comprei um programador CH341A — o gravador SPI barato e onipresente que todo entusiasta de hardware acaba tendo um dia. Ele chegou no dia seguinte.

Mas havia um detalhe: **eu não tinha nenhum computador para usá-lo.**

Meu PC estava morto. O notebook da minha mãe tinha literalmente morrido naquela semana — a tela apagou no meio de uma série e nunca mais voltou. Não havia nenhum outro computador por perto. Era noite. Nenhum amigo com desktop disponível. Nenhuma assistência técnica local aberta que soubesse lidar com gravação SPI.

Olhei para o meu celular. Um Android moderno. USB-C. Suporte OTG.

*"Espera. O CH341A é USB. Meu celular tem USB. Será que dá para usar o celular?"*

## O Problema do Android

O Flashrom é a ferramenta open-source padrão para ler e escrever chips flash. Ele suporta o CH341A nativamente. O problema: é uma ferramenta voltada para o Linux de desktop. Não existe um app Android para isso.

Meu primeiro instinto foi usar o Termux, um emulador de terminal Linux para Android. Eu poderia compilar o flashrom a partir do código-fonte.

```bash
pkg install git meson ninja libusb
git clone https://review.coreboot.org/flashrom.git
cd flashrom
```

Compilei. Funcionou. Mas quando tentei rodar:

```
$ ./build/flashrom -p ch341a_spi -V
Initializing ch341a_spi programmer
libusb: error [sysfs_get_device_list] opendir devices failed, errno=13
Couldn't initialize libusb!
```

Permissão negada. No Android, o SELinux bloqueia o acesso direto ao diretório `/dev/bus/usb/`. Sem root, o `libusb_init()` falha porque tenta escanear o barramento USB na inicialização, e esse scan é negado.

A única forma de acessar hardware USB no Android sem root é através do `termux-usb`, que solicita permissão ao sistema e entrega um File Descriptor (FD) já aberto. Mas o flashrom não sabe o que fazer com um FD; ele espera escanear o barramento por conta própria.

Eu tinha duas opções: esperar por um computador de verdade ou fazer o flashrom entender o Android.

Escolhi a segunda.

## Adicionando Suporte a FD do Android no Flashrom

A ideia principal foi esta: o flashrom usa a `libusb` para se comunicar com o CH341A. O fluxo normal é:

1. `libusb_init(NULL)` — inicializa a biblioteca (escaneia `/dev/bus/usb/`).
2. `libusb_open_device_with_vid_pid()` — encontra e abre o CH341A pelos IDs USB.
3. Comunica-se com o dispositivo.

O passo 1 falha no Android porque o SELinux bloqueia o escaneamento do barramento USB. O passo 2 falha porque depende do primeiro.

Mas a libusb possui uma função pouco conhecida: `libusb_wrap_sys_device()`. Ela recebe um descritor de arquivo (FD) já aberto e o encapsula diretamente em um `libusb_device_handle`. Sem scans, sem buscas por VID/PID. Apenas: "aqui está o FD, me dê o handle".

O detalhe? Você ainda precisa de um `libusb_context` válido. E o `libusb_init()` tenta escanear dispositivos. A solução é a opção `LIBUSB_OPTION_NO_DEVICE_DISCOVERY`, introduzida na libusb 1.0.24. Ela diz à biblioteca: "inicialize-se, mas não saia procurando no `/dev/bus/usb/`".

Aqui está o que adicionei ao `programmers/ch341a_spi.c`:

```c
/* Android FD support: get FD from environment variable */
static int get_android_usb_fd(void)
{
    const char *env_fd = getenv("ANDROID_USB_FD");
    if (env_fd) {
        int fd = atoi(env_fd);
        if (fd > 0) {
            msg_pdbg("Using Android USB FD from env: %d\n", fd);
            return fd;
        }
    }
    return -1;
}
```

E na função de inicialização, antes de qualquer escaneamento USB:

```c
static int ch341a_spi_init(const struct programmer_cfg *cfg)
{
    int android_fd = -1;
    char *fd_param = extract_programmer_param_str(cfg, "fd");
    if (fd_param) {
        android_fd = atoi(fd_param);
        free(fd_param);
    }
    if (android_fd <= 0)
        android_fd = get_android_usb_fd();

    libusb_context *ctx = NULL;

    if (android_fd > 0) {
        /* Android FD mode: pular scan de dispositivos */
        struct libusb_init_option opts = {
            .option = LIBUSB_OPTION_NO_DEVICE_DISCOVERY
        };
        ret = libusb_init_context(&ctx, &opts, 1);
        if (ret < 0) {
            msg_perr("Couldn't initialize libusb context: %s\n",
                     libusb_error_name(ret));
            return -1;
        }
        /* Encapsular o FD diretamente em um device handle */
        ret = libusb_wrap_sys_device(ctx, (intptr_t)android_fd, &data->handle);
        if (ret < 0) {
            msg_perr("Failed to wrap USB device fd %d: %s\n",
                     android_fd, libusb_error_name(ret));
            libusb_exit(ctx);
            return -1;
        }
        msg_pdbg("Successfully wrapped USB device from FD %d\n", android_fd);
    } else {
        /* Caminho original: scan por VID/PID (precisa de root no Android) */
        ret = libusb_init(&ctx);
        // ... código existente ...
    }
    // ... resto da inicialização ...
}
```

O patch completo possui cerca de 130 linhas. Não é muito código, mas muda completamente como o flashrom inicializa no Android.

## Testando ao Vivo

Compilei o flashrom com o patch:

```bash
meson setup build -Dtests=disabled -Dwerror=false -Dprogrammer=ch341a_spi
ninja -C build
```

Em seguida, escrevi um pequeno wrapper em C, já que o `termux-usb` passa o FD como argumento para o processo filho:

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main(int argc, char **argv) {
    if (argc < 2) {
        fprintf(stderr, "Uso: %s <fd>\n", argv[0]);
        return 1;
    }
    int fd = atoi(argv[1]);
    setenv("ANDROID_USB_FD", argv[1], 1);
    execl("./build/flashrom", "flashrom",
          "-p", "ch341a_spi", "--flash-name", NULL);
    return 1;
}
```

E então:

```bash
termux-usb -r -e ./detect_bios /dev/bus/usb/001/003
```

A saída:

```
Initializing ch341a_spi programmer
Using Android USB FD from parameter: 7
LibUSB initialized with NO_DEVICE_DISCOVERY for FD mode
Successfully wrapped USB device from FD 7
Probing for Generic unknown SPI chip (REMS), 0 kB:
    compare_id: id1 0xa1, id2 0x2818
Found Unknown flash chip "SFDP-capable chip" (16384 kB, SPI).
```

Funcionou. O CH341A estava se comunicando com o chip da BIOS. Pelo meu celular. Via USB. Sem root.

## A Recuperação

Com a conexão estabelecida, fiz primeiro um backup completo:

```bash
termux-usb -r -e ./flash_backup /dev/bus/usb/001/003
```

O backup do chip de 16MB levou cerca de 2 minutos. Depois verifiquei — o hash foi idêntico entre duas leituras, confirmando uma conexão estável.

Em seguida, gravei a BIOS correta — o arquivo real da MR9A-H que eu tinha salvo no Google Drive:

```bash
termux-usb -r -E -e './build/flashrom -p ch341a_spi \
  -w /storage/emulated/0/Download/backup_chip_full.rom -V'
```

A gravação levou cerca de 6 minutos. O flashrom reportou:

```
Found Unknown flash chip "SFDP-capable chip" (16384 kB, SPI).
Erasing and writing flash chip... VERIFYING
VERIFIED.
```

Removi o clipe do CH341A da placa-mãe. Reconectei a energia. Apertei o power.

**Deu boot.**

Tela da BIOS. Memória detectada. Processador funcionando. A placa-mãe estava viva de novo.

Validei a gravação lendo o chip mais uma vez e comparando o hash com o arquivo original:

```
Arquivo original:     5fc52519de9b9b9f41e0e62810307d09
Lido do chip:         5fc52519de9b9b9f41e0e62810307d09
✅ CONFERE
```

## O Que Eu Aprendi

### 1. Hardware de baixo custo tem limites

Uma placa X99 de 30 dólares rodando um Xeon de 12 núcleos não é uma combinação sustentável. O VRM vai acabar cedendo. Se você utiliza processadores de alto desempenho, invista em uma placa capaz de fornecer a energia necessária.

### 2. Sempre confira os arquivos de firmware três vezes

Eu tinha o backup correto, mas acabei usando o arquivo errado. Uma pequena distração no nome do arquivo me custou um dia inteiro e a compra de um CH341A. Quando for gravar um firmware, leia o nome do arquivo em voz alta antes de apertar Enter.

### 3. O Android é Linux, mas não é *aquele* Linux

O SELinux está lá por um motivo, mas torna o acesso ao hardware um processo penoso sem root. O caminho do `libusb_wrap_sys_device()` é a forma correta de lidar com USB no Android — e é pouquíssimo documentado.

### 4. O ecossistema de código aberto é incrível

O Flashrom é mantido por desenvolvedores do coreboot que se importam profundamente com a liberdade do hardware. O fato de eu poder modificá-lo, compilá-lo em um celular e recuperar uma placa-mãe é o poder do open-source em ação.

### 5. Celulares são computadores de verdade

Fiz uma recuperação completa de firmware de placa-mãe usando apenas um celular. Sem notebook, sem desktop. Apenas um celular, um programador CH341A de poucos reais e um pouco de código C. O futuro chegou.

## O Patch

O patch de suporte a FD do Android para o flashrom está disponível na minha cópia de trabalho. Se houver interesse, vou limpá-lo e enviá-lo para o Gerrit do flashrom.

O uso é simples:

```bash
# Com wrapper
termux-usb -r -e ./meu_wrapper /dev/bus/usb/001/XXX -- -V

# Ou com variável de ambiente
ANDROID_USB_FD=7 ./build/flashrom -p ch341a_spi -c FM25W128 -w firmware.bin
```

---

Minha X99 está viva. Meu celular provou seu valor como ferramenta de recuperação. E o flashrom agora tem um suporte a Android que não existia antes deste fim de semana.

Às vezes, o melhor código nasce do desespero às 23h, sem computador e com uma placa-mãe morta encarando você.

*Se você está trabalhando na recuperação de hardware via Android ou tem perguntas sobre o patch, deixe um comentário abaixo. E se este post te ajudou, compartilhe — alguém por aí pode estar com uma placa inutilizada agora mesmo tendo apenas um celular no bolso.*

> *See you in the Wired*
