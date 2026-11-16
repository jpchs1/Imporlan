# Instrucción permanente del usuario: GitHub primero

Esta regla se aplica a cualquier cambio web, independientemente del sitio o negocio al que pertenezca.

1. Trabajar primero en una rama de GitHub y abrir un pull request.
2. Probar en un entorno aislado o de pruebas y documentar los resultados y límites de la verificación.
3. Esperar la aprobación explícita del usuario en GitHub antes de integrar el PR o publicar en producción. No autoaprobar ni fusionar los propios cambios para eludir esta aprobación. Que CI pase no equivale a aprobación.
4. No editar producción directamente ni escribir directamente en main. Esta regla incluye arreglos pequeños, correcciones urgentes, cambios de caché y tareas de mantenimiento.
5. Tras la aprobación, desplegar únicamente desde el commit aprobado en GitHub y verificar el resultado público.
6. Ante una regresión, reproducir y preparar el arreglo o la reversión mediante el mismo flujo; no publicar una solución sin aprobar.

El despliegue automático actual toma cambios de main. Por lo tanto, fusionar un PR o escribir en main constituye una acción de publicación y requiere la aprobación previa del usuario.

Conservar las instrucciones específicas existentes del repositorio, especialmente WORKFLOW.md y DEPLOY-SAFETY.md.
