// Listas fijas del taller. Para sumar una opción, se agrega acá.

export const EQUIPOS = [
  { id: 'notebook', nombre: 'Notebook' },
  { id: 'escritorio', nombre: 'PC de escritorio' },
  { id: 'aio', nombre: 'All-in-one' },
  { id: 'celular', nombre: 'Celular' },
];
export const equipoNombre = (id) => (EQUIPOS.find((e) => e.id === id) || { nombre: 'Equipo' }).nombre;

export const SERVICIOS = [
  { id: 'ssd', nombre: 'Cambio de HDD a SSD', aplica: ['notebook', 'escritorio', 'aio'] },
  { id: 'reparacion', nombre: 'Reparación', aplica: ['notebook', 'escritorio', 'aio', 'celular'] },
  { id: 'pantalla', nombre: 'Cambio de pantalla', aplica: ['notebook', 'aio', 'celular'] },
  { id: 'bateria', nombre: 'Cambio de batería', aplica: ['notebook', 'celular'] },
];

export const ACCESORIOS = ['Cargador', 'Funda o bolso', 'Mouse', 'Cable', 'Batería', 'SIM o SD'];

export const DANOS = [
  { id: 'rayones', nombre: 'Rayones', corto: 'rayones' },
  { id: 'golpes', nombre: 'Golpes', corto: 'golpes' },
  { id: 'pantalla', nombre: 'Pantalla rota o dañada', corto: 'pantalla rota' },
  { id: 'tapa', nombre: 'Tapa o bisagras dañadas', corto: 'tapa/bisagras' },
  { id: 'teclas', nombre: 'Teclas faltantes', corto: 'teclas' },
  { id: 'puertos', nombre: 'Puertos dañados', corto: 'puertos' },
  { id: 'humedad', nombre: 'Humedad o líquido', corto: 'humedad' },
  { id: 'noenciende', nombre: 'No enciende', corto: 'no enciende' },
  { id: 'tornillos', nombre: 'Faltan tornillos o precintos', corto: 'faltan tornillos' },
];

export const CLAVES = [
  { id: 'no', nombre: 'Sin clave' },
  { id: 'pass', nombre: 'Contraseña' },
  { id: 'pin', nombre: 'PIN' },
  { id: 'patron', nombre: 'Patrón' },
];
export const claveNombre = (id) => (CLAVES.find((c) => c.id === id) || CLAVES[0]).nombre;

export const ESTADOS = [
  { id: 'recibido', nombre: 'Recibido', corto: 'Recibido' },
  { id: 'en_curso', nombre: 'En reparación', corto: 'En curso' },
  { id: 'listo', nombre: 'Listo para retirar', corto: 'Listo' },
  { id: 'entregado', nombre: 'Entregado', corto: 'Entregado' },
];
export const estadoNombre = (id) => (ESTADOS.find((e) => e.id === id) || ESTADOS[0]).nombre;
export const estadoCorto = (id) => (ESTADOS.find((e) => e.id === id) || ESTADOS[0]).corto;

// Informe técnico
export const RESULTADOS = [
  { id: 'reparado', nombre: 'Reparado y probado', frase: 'El equipo quedó reparado y lo probé antes de entregarlo.' },
  { id: 'mejorado', nombre: 'Mejorado y probado', frase: 'El equipo quedó funcionando mejor y lo probé antes de entregarlo.' },
  { id: 'parcial', nombre: 'Reparado en parte', frase: 'Resolví parte de la falla. Abajo te explico qué queda pendiente.' },
  { id: 'sin_arreglo', nombre: 'Sin reparación posible', frase: 'No fue posible repararlo. Abajo te explico por qué y qué opciones hay.' },
  { id: 'diagnostico', nombre: 'Solo diagnóstico', frase: 'Revisé el equipo y te dejo el diagnóstico y mis recomendaciones.' },
];

export const TAREAS = [
  'Limpieza interna completa',
  'Cambio de pasta térmica',
  'Cambio de disco a SSD',
  'Clonado del sistema al disco nuevo',
  'Instalación limpia de Windows',
  'Actualización de drivers',
  'Eliminación de virus y programas basura',
  'Optimización del inicio de Windows',
  'Ampliación de memoria RAM',
  'Cambio de pantalla',
  'Cambio de batería',
  'Cambio de teclado',
  'Reparación de bisagras',
  'Copia de seguridad de archivos',
];

export const PRUEBAS = [
  'Enciende y arranca bien',
  'Temperaturas normales',
  'Disco en buen estado',
  'Batería carga bien',
  'Wi-Fi y Bluetooth',
  'Puertos USB',
  'Audio y micrófono',
  'Cámara',
  'Teclado y touchpad',
  'Pantalla sin fallas',
  'Prueba de estrés',
  'Windows actualizado',
];

export const METRICAS_SUGERIDAS = [
  'Tiempo de encendido',
  'Temperatura del procesador',
  'Salud del disco',
  'Espacio libre en disco',
  'Programas al inicio',
];

export const RECOMENDACIONES = [
  'Hacé una copia de seguridad de tus archivos una vez por mes.',
  'Traé el equipo a una limpieza interna una vez por año.',
  'Usalo sobre una superficie dura, no sobre la cama o almohadones.',
  'Evitá cargarlo con cargadores genéricos.',
  'No dejes el equipo enchufado al 100% todo el día.',
  'Instalá programas solo desde sus páginas oficiales.',
];

export const REP_DEF = ['SSD 240 GB', 'SSD 480 GB', 'SSD 960 GB', 'Memoria RAM', 'Pantalla notebook', 'Pantalla celular', 'Batería notebook', 'Batería celular'];
