# Sistema de Notificaciones Comprensivo

Este documento describe el sistema de notificaciones completo implementado para la plataforma de expropiación del MOPC.

## 🚀 Características Principales

### 1. **Centro de Notificaciones Centralizado**
- Panel de notificaciones unificado
- Filtrado y búsqueda avanzada
- Operaciones masivas (marcar como leído, eliminar)
- Soporte para múltiples idiomas
- Indicadores visuales de estado

### 2. **Notificaciones en Tiempo Real con WebSocket**
- Conexión WebSocket persistente
- Entrega instantánea de notificaciones
- Manejo de reconexión automática
- Salas temáticas (por usuario, departamento, rol)
- Indicadores de presencia

### 3. **Sistema de Plantillas**
- Plantillas de notificación personalizables
- Variables dinámicas con sustitución automática
- Soporte para contenido HTML y texto plano
- Versiones y aprobación de plantillas
- Traducción multiidioma

### 4. **Preferencias de Usuario**
- Control granular de canales (email, SMS, push, in-app)
- Horas de silencio configurables
- Límites de frecuencia
- Filtros personalizados
- Bloqueo de remitentes

### 5. **Sistema de Email Cola**
- Procesamiento asíncrono de emails
- Reintentos automáticos con backoff exponencial
- Plantillas HTML responsivas
- Seguimiento de entrega
- Análisis de apertura y clics

### 6. **Sistema de Recordatorios Automáticos**
- Configuración basada en reglas
- Recordatorios de plazos y vencimientos
- Escalado automático
- Personalización por entidad
- Integración con flujos de trabajo

### 7. **Historial y Análisis**
- Registro completo de auditoría
- Métricas de entrega
- Análisis de rendimiento
- Reportes por período
- Exportación de datos

## 📁 Estructura de Archivos

```
src/
├── components/notifications/
│   ├── enhanced-notification-center.tsx    # Centro de notificaciones principal
│   ├── notification-preferences.tsx       # Panel de preferencias
│   └── unread-indicator.tsx              # Indicadores visuales
├── hooks/
│   └── use-websocket.ts                    # Hook para WebSocket
├── lib/
│   ├── websocket-server.ts                # Servidor WebSocket
│   ├── email-queue-processor.ts           # Procesador de emails
│   └── notification-reminder-system.ts    # Sistema de recordatorios
├── app/api/notifications/
│   ├── enhanced/route.ts                  # API de notificaciones mejorada
│   ├── preferences/route.ts               # API de preferencias
│   └── templates/route.ts                 # API de plantillas
└── prisma/schema.prisma                   # Modelo de base de datos
```

## 🗄️ Modelo de Base de Datos

### Modelos Principales

#### **Notification**
- Notificaciones completas con metadatos
- Configuración de canales múltiples
- Entidades relacionadas (casos, reuniones, etc.)
- Control de scheduling y expiración

#### **NotificationTemplate**
- Plantillas con variables dinámicas
- Soporte multiidioma
- Control de versiones
- Flujo de aprobación

#### **UserNotificationPreference**
- Preferencias granulares por usuario
- Configuración de horarios de silencio
- Límites de frecuencia
- Filtros personalizados

#### **NotificationHistory**
- Registro completo de auditoría
- Eventos de delivery y tracking
- Métricas de rendimiento

#### **EmailQueue**
- Cola de procesamiento de emails
- Reintentos automáticos
- Seguimiento de entrega

#### **WebSocketConnection**
- Gestión de conexiones WebSocket
- Salas y suscripciones
- Métricas de conexión

#### **ReminderConfig/ReminderJob**
- Configuración de recordatorios automáticos
- Programación basada en reglas
- Historial de ejecución

## 🛠️ Configuración Inicial

### 1. Variables de Entorno

```env
# WebSocket Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME="Sistema MOPC"
SMTP_FROM_EMAIL=noreply@mopc.gov.do

# Database
DATABASE_URL="file:./dev.db"
```

### 2. Inicialización del Sistema

```typescript
// En app/layout.tsx o _app.tsx
import { wsServer } from '@/lib/websocket-server';
import { emailQueueProcessor } from '@/lib/email-queue-processor';
import { reminderSystem } from '@/lib/notification-reminder-system';

// Inicializar sistemas
useEffect(() => {
  // El WebSocket se inicializa automáticamente con el primer cliente
  emailQueueProcessor.start();
  reminderSystem.start();

  return () => {
    emailQueueProcessor.stop();
    reminderSystem.stop();
  };
}, []);
```

## 📡 Uso del Sistema

### 1. **Centro de Notificaciones**

```tsx
import { EnhancedNotificationCenter } from '@/components/notifications/enhanced-notification-center';

function Header() {
  return (
    <EnhancedNotificationCenter
      onNotificationClick={(notification) => {
        // Manejar clic en notificación
        if (notification.entityType === 'case') {
          router.push(`/cases/${notification.entityId}`);
        }
      }}
      showConnectionStatus={true}
      maxVisible={50}
    />
  );
}
```

### 2. **Indicadores de Notificaciones**

```tsx
import { HeaderNotificationIndicator, CompactNotificationIndicator } from '@/components/notifications/unread-indicator';

// En el header principal
<HeaderNotificationIndicator />

// En sidebar o navegación
<CompactNotificationIndicator />
```

### 3. **Preferencias de Usuario**

```tsx
import { NotificationPreferences } from '@/components/notifications/notification-preferences';

function SettingsPage() {
  return (
    <NotificationPreferences
      onSave={(preferences) => {
        console.log('Preferencias guardadas:', preferences);
      }}
    />
  );
}
```

### 4. **WebSocket Hook**

```tsx
import { useWebSocket } from '@/hooks/use-websocket';

function NotificationAwareComponent() {
  const {
    isConnected,
    notifications,
    unreadCount,
    sendNotification,
    joinRoom
  } = useWebSocket({
    autoConnect: true,
    reconnection: true
  });

  return (
    <div>
      <p>Estado: {isConnected ? 'Conectado' : 'Desconectado'}</p>
      <p>No leídas: {unreadCount}</p>
    </div>
  );
}
```

## 📧 Envío de Notificaciones

### 1. **Notificación Simple**

```typescript
// Crear notificación básica
const response = await fetch('/api/notifications/enhanced', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'INFO',
    title: 'Nueva notificación',
    message: 'Este es un mensaje importante',
    recipientId: 'user-id-here',
    priority: 'medium',
    channels: ['in_app', 'email'],
    metadata: {
      caseId: 'case-123',
      actionUrl: '/cases/case-123'
    }
  })
});
```

### 2. **Notificación con Plantilla**

```typescript
// Usar plantilla existente
const response = await fetch('/api/notifications/enhanced', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    templateId: 'template-123',
    recipientId: 'user-id-here',
    variables: {
      userName: 'Juan Pérez',
      caseNumber: 'EXP-2024-001',
      dueDate: '2024-12-31'
    }
  })
});
```

### 3. **Notificación Masiva**

```typescript
// Enviar a múltiples usuarios
const userIds = ['user-1', 'user-2', 'user-3'];

userIds.forEach(userId => {
  fetch('/api/notifications/enhanced', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'SYSTEM_ANNOUNCEMENT',
      title: 'Mantenimiento Programado',
      message: 'El sistema estará en mantenimiento mañana a las 10:00 AM',
      recipientId: userId,
      priority: 'high',
      channels: ['in_app', 'email'],
      correlationId: 'maintenance-2024-12-20'
    })
  });
});
```

## ⏰ Configuración de Recordatorios

### 1. **Recordatorio de Plazo**

```typescript
import { scheduleReminder } from '@/lib/notification-reminder-system';

// Configurar recordatorio automático
const reminderConfig = {
  id: 'deadline-reminder',
  name: 'Recordatorio de Vencimiento',
  description: 'Recordar usuarios sobre plazos próximos',
  type: 'deadline',
  schedule: '0 9 * * *', // Todos los días a las 9 AM
  isActive: true,
  conditions: {
    entityType: 'case',
    filters: {
      status: 'EN_PROGRESO'
    },
    timeBefore: 24 * 60 // 24 horas antes
  },
  templateId: 'deadline-template-123',
  recipients: {
    type: 'entity_owner'
  },
  channels: ['in_app', 'email'],
  priority: 'medium'
};

// Programar para un caso específico
await scheduleReminder(reminderConfig, 'case-123');
```

### 2. **Recordatorio de Reunión**

```typescript
const meetingReminder = {
  id: 'meeting-reminder',
  name: 'Recordatorio de Reunión',
  description: 'Recordar participantes sobre reuniones próximas',
  type: 'deadline',
  conditions: {
    entityType: 'meeting',
    filters: {
      status: 'SCHEDULED'
    },
    timeBefore: 60 // 1 hora antes
  },
  templateId: 'meeting-template-123',
  recipients: {
    type: 'custom',
    customEmails: ['participant1@email.com', 'participant2@email.com']
  },
  channels: ['in_app', 'email']
};
```

## 🎛️ Gestión de Plantillas

### 1. **Crear Plantilla**

```typescript
// POST /api/notifications/templates
const template = {
  name: 'Recordatorio de Caso',
  description: 'Plantilla para recordatorios de casos',
  category: 'CASE',
  type: 'DEADLINE_REMINDER',
  subject: 'Recordatorio: Caso {{caseNumber}}',
  content: 'Estimado/a {{userName}}, le recordamos que el caso {{caseNumber}} tiene una fecha límite approaching.',
  htmlContent: `
    <h1>Recordatorio de Caso</h1>
    <p>Estimado/a <strong>{{userName}}</strong>,</p>
    <p>Le recordamos que el caso <strong>{{caseNumber}}</strong> tiene importantes actualizaciones.</p>
    <p>Fecha límite: {{dueDate}}</p>
    <a href="{{caseUrl}}">Ver caso</a>
  `,
  variables: {
    userName: { type: 'string', description: 'Nombre del usuario' },
    caseNumber: { type: 'string', description: 'Número de caso' },
    dueDate: { type: 'date', description: 'Fecha límite' },
    caseUrl: { type: 'url', description: 'URL del caso' }
  },
  isActive: true,
  language: 'es'
};

await fetch('/api/notifications/templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(template)
});
```

### 2. **Usar Plantilla con Variables**

```typescript
const notification = {
  templateId: 'template-id',
  recipientId: 'user-123',
  variables: {
    userName: 'María García',
    caseNumber: 'EXP-2024-123',
    dueDate: '2024-12-31',
    caseUrl: 'https://mopc.gov.do/cases/EXP-2024-123'
  }
};
```

## 📊 Análisis y Reportes

### 1. **Estadísticas de Notificaciones**

```typescript
// GET /api/notifications/enhanced
const response = await fetch('/api/notifications/enhanced');
const data = await response.json();

console.log('Estadísticas:', data.statistics);
// Output:
// {
//   total: 1250,
//   unread: 23,
//   read: 1227,
//   byType: {
//     info: 450,
//     warning: 234,
//     success: 312,
//     error: 89,
//     task_assigned: 165
//   },
//   byPriority: {
//     low: 567,
//     medium: 423,
//     high: 189,
//     urgent: 71
//   },
//   recentActivity: [...]
// }
```

### 2. **Estadísticas de Email**

```typescript
import { getQueueStats } from '@/lib/email-queue-processor';

const stats = await getQueueStats();
console.log('Estadísticas de Email:', stats);
// Output:
// {
//   total: 890,
//   pending: 12,
//   processing: 3,
//   sent: 865,
//   failed: 10,
//   todaySent: 45,
//   todayFailed: 2
// }
```

## 🔧 Configuración Avanzada

### 1. **Configuración de WebSocket**

```typescript
// En el servidor
import { wsServer } from '@/lib/websocket-server';

// Configurar servidor WebSocket
wsServer.initialize(httpServer);

// Enviar notificación en tiempo real
await wsServer.sendNotification({
  id: 'notif-123',
  title: 'Actualización importante',
  message: 'El sistema ha sido actualizado',
  type: 'SYSTEM_ANNOUNCEMENT',
  priority: 'high',
  userId: 'user-123',
  metadata: {},
  createdAt: new Date()
});

// Enviar a sala específica
await wsServer.sendToRoom('department:legal', {
  type: 'system',
  data: { message: 'Nuevo documento disponible' },
  timestamp: new Date(),
  id: 'msg-456'
});
```

### 2. **Configuración de Email**

```typescript
import { queueEmail, queueBulkEmails } from '@/lib/email-queue-processor';

// Email individual
await queueEmail({
  to: 'user@example.com',
  subject: 'Asunto importante',
  textContent: 'Contenido en texto plano',
  htmlContent: '<h1>Contenido HTML</h1>',
  priority: 'high',
  scheduledAt: new Date(Date.now() + 60 * 60 * 1000), // En 1 hora
  metadata: {
    notificationId: 'notif-123',
    campaign: 'monthly-update'
  }
});

// Email masivo
const emails = [
  { to: 'user1@example.com', subject: 'Hola Usuario 1' },
  { to: 'user2@example.com', subject: 'Hola Usuario 2' }
];

await queueBulkEmails(emails, {
  priority: 'medium',
  batchId: 'campaign-2024-12'
});
```

## 🚨 Manejo de Errores

### 1. **Errores de Conexión WebSocket**

```typescript
const { isConnected, error, connect } = useWebSocket();

useEffect(() => {
  if (!isConnected && error) {
    console.error('Error de conexión:', error);
    // Intentar reconexión automática después de 5 segundos
    const timeout = setTimeout(connect, 5000);
    return () => clearTimeout(timeout);
  }
}, [isConnected, error, connect]);
```

### 2. **Errores de Email**

```typescript
import { retryFailedEmails } from '@/lib/email-queue-processor';

// Reintentar emails fallidos de las últimas 24 horas
const retriedCount = await retryFailedEmails(24);
console.log(`Reintentados ${retriedCount} emails fallidos`);
```

## 📱 Optimización para Móvil

### 1. **Indicadores Compactivos**

```tsx
import { CompactNotificationIndicator } from '@/components/notifications/unread-indicator';

// Perfecto para navegación móvil
<CompactNotificationIndicator className="h-8 w-8" />
```

### 2. **Preferencias Móviles**

El sistema incluye configuración específica para dispositivos móviles:
- Vibración activada/desactivada
- Notificaciones push
- Badges en iconos
- Formatos optimizados para pantallas pequeñas

## 🔐 Consideraciones de Seguridad

### 1. **Validación de Entrada**
- Todos los datos de entrada son validados con Zod schemas
- Sanitización de contenido HTML
- Límites de frecuencia por usuario

### 2. **Permisos y Autorización**
- Verificación de roles para cada acción
- Control de acceso a plantillas por departamento
- Auditoría completa de acciones

### 3. **Seguridad de Conexiones**
- Autenticación JWT para WebSocket
- Validación de tokens en cada conexión
- Cifrado de datos sensibles

## 📈 Monitoreo y Métricas

### 1. **Métricas Clave**
- Tasa de entrega de notificaciones
- Tiempo de respuesta del WebSocket
- Tasa de apertura de emails
- Tiempo de procesamiento de colas

### 2. **Alertas Automáticas**
- Fallos en el sistema de email
- Alta tasa de errores de WebSocket
- Colas de email muy largas

## 🔮 Próximos Pasos

### Mejoras Futuras
1. **Aplicaciones Móviles Nativas**: iOS y Android con notificaciones push nativas
2. **Integración con Slack/Microsoft Teams**: Notificaciones externas
3. **Inteligencia Artificial**: Clasificación automática de prioridades
4. **Dashboard Analítico Avanzado**: Visualizaciones en tiempo real
5. **API Webhooks**: Integración con sistemas externos

---

Este sistema de notificaciones proporciona una solución completa y escalable para todas las necesidades de comunicación de la plataforma de expropiación del MOPC.