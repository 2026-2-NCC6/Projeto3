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
  avaliarSeq,
  base64ParaTexto,
  interpretarMensagem,
  textoParaBase64
} from './protocolo';

export type StatusBle = 'desconectado' | 'procurando' | 'conectando' | 'conectado' | 'reconectando';

export type Estatisticas = {
  golpesRecebidos: number;
  duplicados: number;
  perdidos: number;
  ultimoSeq: number | null;
  reconexoes: number;
};

type BleApi = {
  disponivel: boolean;
  status: StatusBle;
  erro: string | null;
  erroSensor: boolean;
  nomeDispositivo: string | null;
  estadoDispositivo: EstadoDispositivo | null;
  conectar: () => Promise<void>;
  desconectar: () => Promise<void>;
  enviar: (cmd: Comando) => Promise<void>;
  /** Envia o comando e devolve o estado do próximo E: recebido (null se não vier a tempo). */
  enviarEAguardar: (cmd: Comando, timeoutMs?: number) => Promise<EstadoDispositivo | null>;
  aoReceberGolpe: (cb: (g: GolpeSensor) => void) => () => void;
  aoReceberAmostra: (cb: (a: Amostra) => void) => () => void;
  aoReceberBruto: (cb: (texto: string) => void) => () => void;
  estatisticas: () => Estatisticas;
};

const TEMPO_BUSCA_MS = 12000;
const TEMPO_HANDSHAKE_MS = 4000;
const ATRASO_RECONEXAO_INICIAL_MS = 2000;
const ATRASO_RECONEXAO_MAX_MS = 10000;

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

function novasEstatisticas(): Estatisticas {
  return { golpesRecebidos: 0, duplicados: 0, perdidos: 0, ultimoSeq: null, reconexoes: 0 };
}

const BleCtx = createContext<BleApi | null>(null);

export function BleProvider({ children }: { children: React.ReactNode }) {
  const manager = useMemo(criarManager, []);
  const [status, setStatus] = useState<StatusBle>('desconectado');
  const [erro, setErro] = useState<string | null>(null);
  const [erroSensor, setErroSensor] = useState(false);
  const [nomeDispositivo, setNomeDispositivo] = useState<string | null>(null);
  const [estadoDispositivo, setEstadoDispositivo] = useState<EstadoDispositivo | null>(null);

  const dispositivo = useRef<Device | null>(null);
  const inscricoes = useRef<Subscription[]>([]);
  const timeoutBusca = useRef<ReturnType<typeof setTimeout>>();
  const timeoutReconexao = useRef<ReturnType<typeof setTimeout>>();
  const desconexaoIntencional = useRef(false);
  const esperandoEstado = useRef<Array<(e: EstadoDispositivo | null) => void>>([]);
  const ouvintesGolpe = useRef(new Set<(g: GolpeSensor) => void>());
  const ouvintesAmostra = useRef(new Set<(a: Amostra) => void>());
  const ouvintesBruto = useRef(new Set<(t: string) => void>());
  const amostraParcial = useRef<Amostra>({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 });
  const stats = useRef<Estatisticas>(novasEstatisticas());

  const resolverEspera = useCallback((estado: EstadoDispositivo | null) => {
    const fila = esperandoEstado.current;
    esperandoEstado.current = [];
    fila.forEach((resolver) => resolver(estado));
  }, []);

  const limparConexao = useCallback(() => {
    inscricoes.current.forEach((s) => s.remove());
    inscricoes.current = [];
    dispositivo.current = null;
    setEstadoDispositivo(null);
    resolverEspera(null);
  }, [resolverEspera]);

  const pararBusca = useCallback(() => {
    if (timeoutBusca.current) clearTimeout(timeoutBusca.current);
    timeoutBusca.current = undefined;
    manager?.stopDeviceScan().catch(() => {});
  }, [manager]);

  const pararReconexao = useCallback(() => {
    if (timeoutReconexao.current) clearTimeout(timeoutReconexao.current);
    timeoutReconexao.current = undefined;
  }, []);

  useEffect(
    () => () => {
      pararBusca();
      pararReconexao();
      inscricoes.current.forEach((s) => s.remove());
      manager?.destroy().catch(() => {});
    },
    [manager, pararBusca, pararReconexao]
  );

  const tratarMensagem = useCallback(
    (bruta: string) => {
      ouvintesBruto.current.forEach((cb) => cb(bruta));
      const msg = interpretarMensagem(bruta);
      if (!msg) {
        console.warn(`[BLE] mensagem ignorada: ${JSON.stringify(bruta)}`);
        return;
      }
      switch (msg.tipo) {
        case 'golpe': {
          const s = stats.current;
          const { aceitar, lacuna } = avaliarSeq(s.ultimoSeq, msg.golpe.seq);
          if (!aceitar) {
            s.duplicados += 1;
            return;
          }
          if (lacuna > 0) {
            s.perdidos += lacuna;
            console.warn(`[BLE] ${lacuna} golpe(s) perdido(s) antes do seq ${msg.golpe.seq}`);
          }
          s.ultimoSeq = msg.golpe.seq;
          s.golpesRecebidos += 1;
          ouvintesGolpe.current.forEach((cb) => cb(msg.golpe));
          return;
        }
        case 'estado':
          setEstadoDispositivo(msg.estado);
          resolverEspera(msg.estado);
          return;
        case 'erro':
          if (msg.texto === 'MPU') setErroSensor(true);
          else setErro(`O dispositivo respondeu ERR:${msg.texto}`);
          return;
        case 'acel':
          Object.assign(amostraParcial.current, { ax: msg.x, ay: msg.y, az: msg.z });
          return;
        case 'giro':
          Object.assign(amostraParcial.current, { gx: msg.x, gy: msg.y, gz: msg.z });
          ouvintesAmostra.current.forEach((cb) => cb({ ...amostraParcial.current }));
          return;
        case 'amostra':
          ouvintesAmostra.current.forEach((cb) => cb(msg.amostra));
      }
    },
    [resolverEspera]
  );

  const escrever = useCallback(async (cmd: Comando) => {
    const d = dispositivo.current;
    if (!d) throw new Error('sensor desconectado');
    await d.writeCharacteristicWithResponseForService(SERVICE_UUID, CHAR_CMD_UUID, textoParaBase64(cmd));
  }, []);

  const enviarEAguardar = useCallback(
    (cmd: Comando, timeoutMs = 3000) =>
      new Promise<EstadoDispositivo | null>((resolve) => {
        if (!dispositivo.current) {
          resolve(null);
          return;
        }
        const timer = setTimeout(() => {
          esperandoEstado.current = esperandoEstado.current.filter((r) => r !== resolver);
          resolve(null);
        }, timeoutMs);
        const resolver = (estado: EstadoDispositivo | null) => {
          clearTimeout(timer);
          resolve(estado);
        };
        esperandoEstado.current.push(resolver);
        escrever(cmd).catch(() => resolver(null));
      }),
    [escrever]
  );

  // Abre o canal de dados e só considera conectado depois que a placa responde um E:.
  const prepararConexao = useCallback(
    async (conectado: Device, aoCair: (id: string) => void) => {
      await conectado.discoverAllServicesAndCharacteristics();
      dispositivo.current = conectado;
      stats.current.ultimoSeq = null;  // a placa zera o seq no boot
      setErroSensor(false);
      inscricoes.current.push(
        conectado.monitorCharacteristicForService(SERVICE_UUID, CHAR_DADOS_UUID, (e, c) => {
          if (e || !c?.value) return;
          tratarMensagem(base64ParaTexto(c.value));
        })
      );

      const estado = await enviarEAguardar('PING', TEMPO_HANDSHAKE_MS);
      if (!estado) {
        limparConexao();
        await conectado.cancelConnection().catch(() => {});
        throw new Error('o dispositivo não respondeu ao PING');
      }

      setNomeDispositivo(conectado.name ?? conectado.localName ?? NOME_DISPOSITIVO);
      inscricoes.current.push(
        conectado.onDisconnected(() => {
          limparConexao();
          if (desconexaoIntencional.current) return;
          aoCair(conectado.id);
        })
      );
      setErro(null);
      setStatus('conectado');
    },
    [enviarEAguardar, limparConexao, tratarMensagem]
  );

  const agendarReconexao = useCallback(
    (id: string, atrasoMs: number) => {
      if (!manager) return;
      setStatus('reconectando');
      pararReconexao();
      timeoutReconexao.current = setTimeout(async () => {
        timeoutReconexao.current = undefined;
        if (desconexaoIntencional.current) return;
        stats.current.reconexoes += 1;
        try {
          const d = await manager.connectToDevice(id, { timeout: 8000, requestMTU: 185 });
          await prepararConexao(d, (idCaido) => agendarReconexao(idCaido, ATRASO_RECONEXAO_INICIAL_MS));
        } catch {
          if (!desconexaoIntencional.current) {
            agendarReconexao(id, Math.min(atrasoMs * 2, ATRASO_RECONEXAO_MAX_MS));
          }
        }
      }, atrasoMs);
    },
    [manager, pararReconexao, prepararConexao]
  );

  const aoCairConexao = useCallback(
    (id: string) => {
      setErro('Conexão com o sensor perdida. Tentando reconectar…');
      agendarReconexao(id, ATRASO_RECONEXAO_INICIAL_MS);
    },
    [agendarReconexao]
  );

  const conectar = useCallback(async () => {
    if (!manager) return;
    desconexaoIntencional.current = false;
    setErro(null);
    stats.current = novasEstatisticas();

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
      setStatus('conectando');
      d.connect({ timeout: 10000, requestMTU: 185 })
        .then((conectado) => prepararConexao(conectado, aoCairConexao))
        .catch((err: Error) => {
          limparConexao();
          setStatus('desconectado');
          setErro(`Falha ao conectar: ${err.message}`);
        });
    });
  }, [manager, pararBusca, prepararConexao, aoCairConexao, limparConexao]);

  const desconectar = useCallback(async () => {
    desconexaoIntencional.current = true;
    pararBusca();
    pararReconexao();
    const d = dispositivo.current;
    if (d) await escrever('STOP').catch(() => {});
    limparConexao();
    setNomeDispositivo(null);
    setStatus('desconectado');
    setErro(null);
    if (d) await d.cancelConnection().catch(() => {});
  }, [pararBusca, pararReconexao, escrever, limparConexao]);

  const enviar = useCallback(
    async (cmd: Comando) => {
      if (!dispositivo.current) return;
      try {
        await escrever(cmd);
      } catch (e) {
        setErro(`Falha ao enviar ${cmd}: ${(e as Error).message}`);
      }
    },
    [escrever]
  );

  const inscrever = <T,>(conjunto: React.MutableRefObject<Set<(v: T) => void>>) => (cb: (v: T) => void) => {
    conjunto.current.add(cb);
    return () => {
      conjunto.current.delete(cb);
    };
  };
  const aoReceberGolpe = useMemo(() => inscrever(ouvintesGolpe), []);
  const aoReceberAmostra = useMemo(() => inscrever(ouvintesAmostra), []);
  const aoReceberBruto = useMemo(() => inscrever(ouvintesBruto), []);
  const estatisticas = useCallback(() => ({ ...stats.current }), []);

  const valor = useMemo<BleApi>(
    () => ({
      disponivel: manager !== null,
      status,
      erro,
      erroSensor,
      nomeDispositivo,
      estadoDispositivo,
      conectar,
      desconectar,
      enviar,
      enviarEAguardar,
      aoReceberGolpe,
      aoReceberAmostra,
      aoReceberBruto,
      estatisticas
    }),
    [manager, status, erro, erroSensor, nomeDispositivo, estadoDispositivo, conectar, desconectar, enviar, enviarEAguardar, aoReceberGolpe, aoReceberAmostra, aoReceberBruto, estatisticas]
  );

  return <BleCtx.Provider value={valor}>{children}</BleCtx.Provider>;
}

export function useBle() {
  const ctx = useContext(BleCtx);
  if (!ctx) throw new Error('useBle precisa estar dentro de <BleProvider>');
  return ctx;
}

/** Só recebe amostras enquanto o debug (DBG:1) estiver ligado na placa. */
export function useAmostraAoVivo() {
  const { aoReceberAmostra } = useBle();
  const [amostra, setAmostra] = useState<Amostra | null>(null);
  useEffect(() => aoReceberAmostra(setAmostra), [aoReceberAmostra]);
  return amostra;
}
