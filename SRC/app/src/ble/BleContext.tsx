import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import type { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  Amostra,
  CHAR_CMD_UUID,
  CHAR_DADOS_UUID,
  Comando,
  EstadoDispositivo,
  GolpeSensor,
  NOME_DISPOSITIVO,
  SERVICE_UUID,
  base64ParaTexto,
  interpretarMensagem,
  textoParaBase64
} from './protocolo';

export type StatusBle = 'desconectado' | 'procurando' | 'conectando' | 'conectado';

type Feedback = { led: boolean; buzzer: boolean };

type BleApi = {
  disponivel: boolean;
  status: StatusBle;
  erro: string | null;
  nomeDispositivo: string | null;
  estadoDispositivo: EstadoDispositivo | null;
  feedback: Feedback;
  conectar: () => Promise<void>;
  desconectar: () => Promise<void>;
  enviar: (cmd: Comando) => Promise<void>;
  definirFeedback: (f: Feedback) => void;
  aoReceberGolpe: (cb: (g: GolpeSensor) => void) => () => void;
  aoReceberAmostra: (cb: (a: Amostra) => void) => () => void;
};

const TEMPO_BUSCA_MS = 12000;

// Expo Go não inclui o módulo nativo de BLE: o construtor lança e o app segue em modo demonstração.
function criarManager(): BleManager | null {
  try {
    const { BleManager: Manager } = require('react-native-ble-plx') as typeof import('react-native-ble-plx');
    return new Manager();
  } catch {
    return null;
  }
}

async function pedirPermissoes(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const r = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
    ]);
    return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  }
  const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return r === PermissionsAndroid.RESULTS.GRANTED;
}

function ehDispositivoDoProjeto(d: Device) {
  return (
    d.name === NOME_DISPOSITIVO ||
    d.localName === NOME_DISPOSITIVO ||
    (d.serviceUUIDs ?? []).some((u) => u.toLowerCase() === SERVICE_UUID)
  );
}

const BleCtx = createContext<BleApi | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const manager = useMemo(criarManager, []);
  const [status, setStatus] = useState<StatusBle>('desconectado');
  const [erro, setErro] = useState<string | null>(null);
  const [nomeDispositivo, setNomeDispositivo] = useState<string | null>(null);
  const [estadoDispositivo, setEstadoDispositivo] = useState<EstadoDispositivo | null>(null);
  const [feedback, setFeedback] = useState<Feedback>({ led: true, buzzer: true });

  const dispositivo = useRef<Device | null>(null);
  const inscricoes = useRef<Subscription[]>([]);
  const timeoutBusca = useRef<ReturnType<typeof setTimeout>>();
  const ouvintesGolpe = useRef(new Set<(g: GolpeSensor) => void>());
  const ouvintesAmostra = useRef(new Set<(a: Amostra) => void>());
  const feedbackRef = useRef(feedback);
  feedbackRef.current = feedback;

  const limpar = useCallback(() => {
    inscricoes.current.forEach((s) => s.remove());
    inscricoes.current = [];
    dispositivo.current = null;
    setNomeDispositivo(null);
    setEstadoDispositivo(null);
  }, []);

  const pararBusca = useCallback(() => {
    if (timeoutBusca.current) clearTimeout(timeoutBusca.current);
    timeoutBusca.current = undefined;
    manager?.stopDeviceScan().catch(() => {});
  }, [manager]);

  useEffect(
    () => () => {
      pararBusca();
      inscricoes.current.forEach((s) => s.remove());
      manager?.destroy().catch(() => {});
    },
    [manager, pararBusca]
  );

  const escrever = useCallback(async (cmd: Comando) => {
    const d = dispositivo.current;
    if (!d) return;
    await d.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_CMD_UUID, textoParaBase64(cmd));
  }, []);

  const tratarMensagem = useCallback((bruta: string) => {
    const msg = interpretarMensagem(bruta);
    if (!msg) return;
    if (msg.tipo === 'amostra') ouvintesAmostra.current.forEach((cb) => cb(msg.amostra));
    else if (msg.tipo === 'golpe') ouvintesGolpe.current.forEach((cb) => cb(msg.golpe));
    else if (msg.tipo === 'estado') setEstadoDispositivo(msg.estado);
    else setErro(`Dispositivo recusou o comando: ${msg.texto}`);
  }, []);

  const iniciarSessaoBle = useCallback(
    async (alvo: Device) => {
      setStatus('conectando');
      const conectado = await alvo.connect({ timeout: 10000, requestMTU: 185 });
      await conectado.discoverAllServicesAndCharacteristics();
      dispositivo.current = conectado;
      setNomeDispositivo(conectado.name ?? conectado.localName ?? NOME_DISPOSITIVO);

      inscricoes.current.push(
        conectado.monitorCharacteristicForService(SERVICE_UUID, CHAR_DADOS_UUID, (e, c) => {
          if (e || !c?.value) return;
          tratarMensagem(base64ParaTexto(c.value));
        }),
        conectado.onDisconnected(() => {
          limpar();
          setStatus('desconectado');
          setErro('Conexão com o sensor perdida. O dispositivo entrou em parada segura.');
        })
      );

      const f = feedbackRef.current;
      await escrever(f.led ? 'LED:1' : 'LED:0');
      await escrever(f.buzzer ? 'BUZ:1' : 'BUZ:0');
      await escrever('PING');
      setStatus('conectado');
    },
    [escrever, limpar, tratarMensagem]
  );

  const conectar = useCallback(async () => {
    if (!manager) return;
    setErro(null);

    if (!(await pedirPermissoes())) {
      setErro('Permissão de Bluetooth negada. Libere nas configurações do celular.');
      return;
    }
    if ((await manager.state()) !== 'PoweredOn') {
      setErro('Ligue o Bluetooth do celular e tente de novo.');
      return;
    }

    setStatus('procurando');
    timeoutBusca.current = setTimeout(() => {
      pararBusca();
      setStatus('desconectado');
      setErro(`${NOME_DISPOSITIVO} não encontrado. Verifique se o Arduino está ligado e por perto.`);
    }, TEMPO_BUSCA_MS);

    await manager.startDeviceScan(null, null, (e, d) => {
      if (e) {
        pararBusca();
        setStatus('desconectado');
        setErro(e.message);
        return;
      }
      if (!d || !ehDispositivoDoProjeto(d) || !timeoutBusca.current) return;
      pararBusca();
      iniciarSessaoBle(d).catch((err: Error) => {
        limpar();
        setStatus('desconectado');
        setErro(`Falha ao conectar: ${err.message}`);
      });
    });
  }, [manager, pararBusca, iniciarSessaoBle, limpar]);

  const desconectar = useCallback(async () => {
    pararBusca();
    const d = dispositivo.current;
    limpar();
    setStatus('desconectado');
    setErro(null);
    if (d) {
      await escreverSilencioso(d, 'STOP');
      await d.cancelConnection().catch(() => {});
    }
  }, [pararBusca, limpar]);

  const enviar = useCallback(
    async (cmd: Comando) => {
      try {
        await escrever(cmd);
      } catch (e) {
        setErro(`Falha ao enviar ${cmd}: ${(e as Error).message}`);
      }
    },
    [escrever]
  );

  const definirFeedback = useCallback(
    (f: Feedback) => {
      setFeedback(f);
      enviar(f.led ? 'LED:1' : 'LED:0');
      enviar(f.buzzer ? 'BUZ:1' : 'BUZ:0');
    },
    [enviar]
  );

  const aoReceberGolpe = useCallback((cb: (g: GolpeSensor) => void) => {
    ouvintesGolpe.current.add(cb);
    return () => {
      ouvintesGolpe.current.delete(cb);
    };
  }, []);

  const aoReceberAmostra = useCallback((cb: (a: Amostra) => void) => {
    ouvintesAmostra.current.add(cb);
    return () => {
      ouvintesAmostra.current.delete(cb);
    };
  }, []);

  const valor = useMemo<BleApi>(
    () => ({
      disponivel: manager !== null,
      status,
      erro,
      nomeDispositivo,
      estadoDispositivo,
      feedback,
      conectar,
      desconectar,
      enviar,
      definirFeedback,
      aoReceberGolpe,
      aoReceberAmostra
    }),
    [manager, status, erro, nomeDispositivo, estadoDispositivo, feedback, conectar, desconectar, enviar, definirFeedback, aoReceberGolpe, aoReceberAmostra]
  );

  return <BleCtx.Provider value={valor}>{children}</BleCtx.Provider>;
}

async function escreverSilencioso(d: Device, cmd: Comando) {
  await d.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_CMD_UUID, textoParaBase64(cmd)).catch(() => {});
}

export function useBle() {
  const ctx = useContext(BleCtx);
  if (!ctx) throw new Error('useBle precisa estar dentro de <BleProvider>');
  return ctx;
}

export function useAmostraAoVivo() {
  const { aoReceberAmostra } = useBle();
  const [amostra, setAmostra] = useState<Amostra | null>(null);
  useEffect(() => aoReceberAmostra(setAmostra), [aoReceberAmostra]);
  return amostra;
}
