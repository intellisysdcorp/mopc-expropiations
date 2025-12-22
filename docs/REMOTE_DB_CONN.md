# Descripción

Aquí se describen los pasos para conectarse a la base de datos remota (QA) a través de un túnel proxy. Esto permite correr la aplicación con la base de datos en el servidor remoto, y da la oportunidad de ver los datos que existen en la misma sin necesidad de accesarla a través de Google Cloud. 

## Prerrequisitos

Instalar estos dos paquetes de terminal:

- [SQL Auth Proxy](https://docs.cloud.google.com/sql/docs/mysql/sql-proxy)
  - Este es un simple script que crea una conexión segura al proyecto. Para poder correrlo desde cualquier directorio en tu terminal, haz lo siguiente:

  ```bash
  # En la carpeta donde se descargó el script
  chmod +x cloud-sql-proxy
  ```

  Luego, lo mueves a la carpeta donde están todos los ejecutables. En el caso de MacOS:

  ```bash
  # Cambia el valor <carpeta-de-descarga>
  sudo mv <carpeta-de-descarga>/cloud-sql-proxy /usr/local/bin/
  ```
- [Google SDK](https://docs.cloud.google.com/sdk/docs/install-sdk). Si aún no has configurado el SDK, sigue [esta documentación](https://docs.cloud.google.com/sdk/docs/initializing#initialize_the). Asegúrate de iniciar sesión con tu cuenta de Intellisys. 

## Permisos

Para poder accesar la base de datos, vas a necesitar tener los permisos relevantes al proyecto. Lo puedes solicitar al encargado de Devops. 

## Conexión

En el archivo `.env` hay un apartado para colocar las credenciales de la base de datos remota. Unos están llenos, pero otros más sensibles, como el nombre de la base de datos, usuario y contraseña, están vacíos. Solicita estas credenciales al Devops o a un desarrollador que haya trabajado en el proyecto. 

Cuando tengas todas estas variables, comenta las de mismo nombre que están más arriba (las correspondientes a la conexión local). 

Finalmente, corre este comando para conectarte a la base de datos remota:

```bash
cloud-sql-proxy af-mopc-expropiacion:us-east1:mopc-expropiacion-development-db --port=5432
```

Ahora puedes correr todos los scripts en `package.json` con la base de datos remota. 

### Ten cuidado de correr los scripts:

- `npm run db:reset`, elimina la base de datos actual
- `npm run db:push`, sincroniza la base de datos con el schema. Si este último ha cambiado, se pueden perder datos. 