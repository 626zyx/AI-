Deployment Guide
================

FAQ: How do I deploy using Docker Compose?
------------------------------------------

1. Download the ``docker-compose.yml`` from the releases page
2. Create a ``.env`` file with required environment variables
3. Run ``docker compose up -d``
4. Access the application at ``http://localhost:8080``
5. Run the health check: ``curl http://localhost:8080/healthz``

FAQ: How do I deploy on Kubernetes?
-------------------------------------
We provide an official Helm chart at ``helm.platform.example.com``. Add the repository with:

.. code-block:: bash

   helm repo add platform https://charts.platform.example.com
   helm install my-deployment platform/platform-stack

FAQ: How do I configure database connection pooling?
-----------------------------------------------------
Set the following environment variables:
- ``DB_POOL_SIZE``: Maximum connections in the pool (default: 20)
- ``DB_POOL_TIMEOUT``: Seconds to wait for a connection (default: 30)
- ``DB_POOL_IDLE_TIMEOUT``: Seconds before idle connections are closed (default: 300)
