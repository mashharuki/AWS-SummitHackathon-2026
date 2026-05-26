# AWS Architecture Diagrams

Read this file when the user requests an AWS architecture diagram, or when any diagram includes AWS services. The goal is to produce Dojo-quality diagrams every time — matching the standard of presentations at AWS Summit and AWS Architecture Dojo events.

## Quality Standard: AWS Architecture Dojo Level

A Dojo-level diagram has these characteristics — verify all of them before final export:

1. Official AWS service icons (never generic rounded rectangles for AWS services)
2. Icon `fillColor` matches the correct AWS category color
3. Labels appear **below** each icon, never inside it
4. Clear AWS Cloud outer boundary, then Region → VPC → AZ → Subnet nesting
5. Public vs private subnets visually distinct (green vs blue border)
6. Internet Gateway shown at the VPC edge; NAT Gateway in public subnet when private subnet needs outbound internet
7. Data flow arrows labeled with protocol or operation name (HTTPS, gRPC, Invoke, CRUD, etc.)
8. Sequential step numbers ①②③... on arrows when showing a request walkthrough
9. Title block in upper-left: diagram name (bold, 20pt) + version/date below it (12pt)
10. Legend box if any abbreviation or non-standard symbol appears
11. No crossing arrows; no overlapping elements; consistent spacing throughout
12. Clean white background

---

## Official AWS Icons for draw.io

### Built-in AWS4 Shapes (No Installation Needed)

draw.io ships with the AWS4 shape library. All services use this pattern:

```
shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.<SERVICE_NAME>;
```

Replace `<SERVICE_NAME>` with the value from the lookup tables below.

### Downloading Official Icons (for Newer Services)

When a service's resIcon is not rendering (shape appears as a placeholder box):

1. Visit **https://aws.amazon.com/architecture/icons/**
2. Download "AWS Architecture Icons" — the zip includes a `.drawio` asset file
3. In draw.io desktop: **Extras → Edit Libraries** → import the downloaded XML, OR open the `.drawio` stencil file directly as a reference diagram
4. Alternatively, search "AWS" in draw.io's shape search panel to find any missing shape

---

## AWS Service Icon Style Template

All resource icons share this base style. Swap `fillColor` and `resIcon` per service:

```xml
<mxCell id="N" value="Service Full Name"
  style="outlineConnect=0;fontColor=#232F3E;gradientColor=none;strokeColor=none;
         fillColor=<CATEGORY_COLOR>;labelBackgroundColor=#ffffff;
         align=center;html=1;fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;
         shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.<SERVICE>;
         labelPosition=center;verticalLabelPosition=bottom;verticalAlign=top;"
  vertex="1" parent="PARENT_ID">
  <mxGeometry x="X" y="Y" width="60" height="60" as="geometry" />
</mxCell>
```

**Standard icon size:** `width="60" height="60"` — label renders below the cell boundary via `verticalLabelPosition=bottom`.

**Always use the full AWS service name** as the `value` (e.g., "Amazon DynamoDB", "AWS Lambda").

---

## AWS Service Icon Lookup Tables

### Compute — fillColor `#FF9900`

| Service | resIcon |
|---------|---------|
| AWS Lambda | `mxgraph.aws4.lambda` |
| Amazon EC2 | `mxgraph.aws4.ec2` |
| Amazon ECS | `mxgraph.aws4.ecs` |
| Amazon EKS | `mxgraph.aws4.eks` |
| AWS Fargate | `mxgraph.aws4.fargate` |
| Amazon ECR | `mxgraph.aws4.ecr` |
| EC2 Auto Scaling | `mxgraph.aws4.auto_scaling2` |
| AWS Batch | `mxgraph.aws4.batch` |
| AWS App Runner | `mxgraph.aws4.app_runner` |
| Amazon Lightsail | `mxgraph.aws4.lightsail` |

### Networking & Content Delivery — fillColor `#8C4FFF`

| Service | resIcon |
|---------|---------|
| Amazon CloudFront | `mxgraph.aws4.cloudfront` |
| Amazon Route 53 | `mxgraph.aws4.route_53` |
| Amazon VPC | `mxgraph.aws4.vpc` |
| Internet Gateway | `mxgraph.aws4.internet_gateway` |
| NAT Gateway | `mxgraph.aws4.nat_gateway` |
| Application Load Balancer | `mxgraph.aws4.application_load_balancer` |
| Network Load Balancer | `mxgraph.aws4.network_load_balancer` |
| Gateway Load Balancer | `mxgraph.aws4.gateway_load_balancer` |
| AWS WAF | `mxgraph.aws4.waf` |
| AWS Shield | `mxgraph.aws4.shield` |
| AWS Global Accelerator | `mxgraph.aws4.global_accelerator` |
| VPC Endpoint | `mxgraph.aws4.vpc_endpoints` |
| AWS Direct Connect | `mxgraph.aws4.direct_connect` |
| AWS Transit Gateway | `mxgraph.aws4.transit_gateway` |
| AWS PrivateLink | `mxgraph.aws4.privatelink` |
| Amazon API Gateway (REST) | `mxgraph.aws4.api_gateway` |

### Storage — fillColor `#3F8624`

| Service | resIcon |
|---------|---------|
| Amazon S3 | `mxgraph.aws4.s3` |
| Amazon EFS | `mxgraph.aws4.efs` |
| Amazon EBS | `mxgraph.aws4.ebs` |
| AWS Backup | `mxgraph.aws4.backup` |
| Amazon S3 Glacier | `mxgraph.aws4.s3_glacier` |
| AWS Storage Gateway | `mxgraph.aws4.storage_gateway` |
| Amazon FSx | `mxgraph.aws4.fsx` |

### Database — fillColor `#1A6BAC`

| Service | resIcon |
|---------|---------|
| Amazon DynamoDB | `mxgraph.aws4.dynamodb` |
| Amazon RDS | `mxgraph.aws4.rds` |
| Amazon Aurora | `mxgraph.aws4.aurora` |
| Amazon ElastiCache | `mxgraph.aws4.elasticache` |
| Amazon Redshift | `mxgraph.aws4.redshift` |
| Amazon DocumentDB | `mxgraph.aws4.documentdb` |
| Amazon Neptune | `mxgraph.aws4.neptune` |
| Amazon MemoryDB for Redis | `mxgraph.aws4.memorydb_for_redis` |
| Amazon Keyspaces | `mxgraph.aws4.keyspaces` |
| Amazon QLDB | `mxgraph.aws4.qldb` |
| Amazon Timestream | `mxgraph.aws4.timestream` |

### Application Integration — fillColor `#E7157B`

| Service | resIcon |
|---------|---------|
| Amazon SQS | `mxgraph.aws4.sqs` |
| Amazon SNS | `mxgraph.aws4.sns` |
| Amazon EventBridge | `mxgraph.aws4.eventbridge` |
| AWS Step Functions | `mxgraph.aws4.step_functions` |
| Amazon MQ | `mxgraph.aws4.mq` |
| AWS AppSync | `mxgraph.aws4.appsync` |
| Amazon Kinesis | `mxgraph.aws4.kinesis` |
| Amazon Kinesis Data Firehose | `mxgraph.aws4.kinesis_firehose` |
| Amazon MSK | `mxgraph.aws4.managed_streaming_for_apache_kafka` |
| AWS SWF | `mxgraph.aws4.swf` |

### Security, Identity & Compliance — fillColor `#DD344C`

| Service | resIcon |
|---------|---------|
| Amazon Cognito | `mxgraph.aws4.cognito` |
| AWS IAM | `mxgraph.aws4.role` |
| AWS IAM Identity Center | `mxgraph.aws4.single_sign_on` |
| AWS Secrets Manager | `mxgraph.aws4.secrets_manager` |
| AWS KMS | `mxgraph.aws4.key_management_service` |
| AWS Certificate Manager | `mxgraph.aws4.certificate_manager` |
| AWS CloudTrail | `mxgraph.aws4.cloudtrail` |
| AWS Config | `mxgraph.aws4.config` |
| Amazon GuardDuty | `mxgraph.aws4.guardduty` |
| Amazon Inspector | `mxgraph.aws4.inspector` |
| Amazon Macie | `mxgraph.aws4.macie` |
| AWS Security Hub | `mxgraph.aws4.security_hub` |
| AWS Verified Access | `mxgraph.aws4.verified_access` |

### Machine Learning & AI — fillColor `#01A88D`

| Service | resIcon |
|---------|---------|
| Amazon Bedrock | `mxgraph.aws4.bedrock` |
| Amazon SageMaker | `mxgraph.aws4.sagemaker` |
| Amazon Rekognition | `mxgraph.aws4.rekognition` |
| Amazon Comprehend | `mxgraph.aws4.comprehend` |
| Amazon Textract | `mxgraph.aws4.textract` |
| Amazon Transcribe | `mxgraph.aws4.transcribe` |
| Amazon Polly | `mxgraph.aws4.polly` |
| Amazon Translate | `mxgraph.aws4.translate` |
| Amazon Kendra | `mxgraph.aws4.kendra` |
| Amazon Q | `mxgraph.aws4.q` |
| Amazon Lex | `mxgraph.aws4.lex` |
| Amazon Personalize | `mxgraph.aws4.personalize` |
| Amazon Forecast | `mxgraph.aws4.forecast` |

### Analytics — fillColor `#8C4FFF`

| Service | resIcon |
|---------|---------|
| Amazon Athena | `mxgraph.aws4.athena` |
| AWS Glue | `mxgraph.aws4.glue` |
| Amazon OpenSearch Service | `mxgraph.aws4.opensearch_service` |
| Amazon EMR | `mxgraph.aws4.emr` |
| Amazon QuickSight | `mxgraph.aws4.quicksight` |
| AWS Lake Formation | `mxgraph.aws4.lake_formation` |
| Amazon Data Pipeline | `mxgraph.aws4.data_pipeline` |

### Management & Governance — fillColor `#E7157B`

| Service | resIcon |
|---------|---------|
| Amazon CloudWatch | `mxgraph.aws4.cloudwatch` |
| AWS CloudFormation | `mxgraph.aws4.cloudformation` |
| AWS Systems Manager | `mxgraph.aws4.systems_manager` |
| AWS Organizations | `mxgraph.aws4.organizations` |
| AWS Trusted Advisor | `mxgraph.aws4.trusted_advisor` |
| AWS Control Tower | `mxgraph.aws4.control_tower` |
| AWS Service Catalog | `mxgraph.aws4.service_catalog` |
| AWS X-Ray | `mxgraph.aws4.xray` |
| Amazon Managed Grafana | `mxgraph.aws4.managed_grafana` |

### Developer Tools — fillColor `#C7131F`

| Service | resIcon |
|---------|---------|
| AWS CodePipeline | `mxgraph.aws4.codepipeline` |
| AWS CodeBuild | `mxgraph.aws4.codebuild` |
| AWS CodeDeploy | `mxgraph.aws4.codedeploy` |
| AWS CodeCommit | `mxgraph.aws4.codecommit` |
| AWS CDK | `mxgraph.aws4.cloud_development_kit` |

### Front-End Web & Mobile — fillColor `#FF9900`

| Service | resIcon |
|---------|---------|
| AWS Amplify | `mxgraph.aws4.amplify` |
| Amazon Location Service | `mxgraph.aws4.location_service` |
| Amazon Cognito (also Security) | `mxgraph.aws4.cognito` |

### Business Applications — fillColor `#E7157B`

| Service | resIcon |
|---------|---------|
| Amazon SES | `mxgraph.aws4.ses` |
| Amazon Pinpoint | `mxgraph.aws4.pinpoint` |
| Amazon Chime | `mxgraph.aws4.chime` |
| Amazon Connect | `mxgraph.aws4.connect` |
| Amazon WorkMail | `mxgraph.aws4.workmail` |

### General / Non-Service Icons — fillColor `#232F3E`

| Element | shape style |
|---------|-------------|
| Human user | `shape=mxgraph.aws4.user` |
| Mobile client | `shape=mxgraph.aws4.mobile_client` |
| Web browser | `shape=mxgraph.aws4.browser` |
| Internet | `shape=mxgraph.aws4.internet` |
| Corporate / on-premises | `shape=mxgraph.aws4.corporate_data_center` |
| Traditional server | `shape=mxgraph.aws4.traditional_server` |

For general icons, use this style:
```
outlineConnect=0;fontColor=#232F3E;gradientColor=none;strokeColor=none;
fillColor=#232F3E;labelBackgroundColor=#ffffff;align=center;html=1;
fontSize=12;fontStyle=0;aspect=fixed;pointerEvents=1;
shape=mxgraph.aws4.<SHAPE>;
labelPosition=center;verticalLabelPosition=bottom;verticalAlign=top;
```

---

## Group / Container Styles

These containers establish the AWS logical boundaries. All use `container=1;pointerEvents=0;collapsible=0;recursiveResize=0;` so children snap inside them.

The standard `points=` list enables connection points on all four sides — paste it verbatim:
```
points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
```

### Container XML Snippets

```xml
<!-- ① AWS Account (outermost) -->
<mxCell id="acct" value="AWS Account"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_account;
         strokeColor=#232F3E;fillColor=#FFFFFF;
         verticalAlign=top;align=center;html=1;fontSize=14;fontStyle=1;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ② AWS Region -->
<mxCell id="region" value="AWS Region (ap-northeast-1)"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_region;
         strokeColor=#232F3E;fillColor=#FFFFFF;
         verticalAlign=top;align=center;html=1;fontSize=13;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="acct">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ③ VPC -->
<mxCell id="vpc" value="VPC (10.0.0.0/16)"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_vpc;
         strokeColor=#8C4FFF;fillColor=#F4EBFF;
         verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="region">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ④ Availability Zone -->
<mxCell id="az_a" value="Availability Zone a"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_availability_zone;
         strokeColor=#232F3E;fillColor=none;
         verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="vpc">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ⑤ Public Subnet (green) -->
<mxCell id="pub_sub" value="Public Subnet (10.0.1.0/24)"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet;
         strokeColor=#00A86B;fillColor=#E5F9F2;
         verticalAlign=top;align=center;html=1;fontSize=11;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="az_a">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ⑥ Private Subnet (blue) -->
<mxCell id="priv_sub" value="Private Subnet (10.0.2.0/24)"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_subnet;
         strokeColor=#147EBA;fillColor=#E8F4FD;
         verticalAlign=top;align=center;html=1;fontSize=11;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="az_a">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ⑦ Security Group -->
<mxCell id="sg" value="Security Group"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_security_group;
         strokeColor=#DD344C;fillColor=none;
         verticalAlign=top;align=center;html=1;fontSize=11;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>

<!-- ⑧ Auto Scaling Group (orange) -->
<mxCell id="asg" value="Auto Scaling Group"
  style="points=[[0,0],[0.25,0],[0.5,0],[0.75,0],[1,0],[1,0.25],[1,0.5],[1,0.75],[1,1],[0.75,1],[0.5,1],[0.25,1],[0,1],[0,0.75],[0,0.5],[0,0.25]];
         shape=mxgraph.aws4.group;grIcon=mxgraph.aws4.group_auto_scaling_group;
         strokeColor=#FF9900;fillColor=#FFF3E0;
         verticalAlign=top;align=center;html=1;fontSize=11;fontStyle=0;
         container=1;pointerEvents=0;collapsible=0;recursiveResize=0;"
  vertex="1" parent="1">
  <mxGeometry x="X" y="Y" width="W" height="H" as="geometry"/>
</mxCell>
```

---

## Layout Conventions

### Nesting Order (always nest in this sequence)

```
AWS Account
  └─ AWS Region
       └─ VPC (CIDR)
            └─ Availability Zone a / b / c
                 ├─ Public Subnet
                 │    └─ Internet Gateway, NAT Gateway, ALB, Bastion
                 └─ Private Subnet
                      └─ Application servers, Lambda (VPC), RDS, ElastiCache
```

Global / edge services (CloudFront, Route 53, WAF, Global Accelerator) live **outside** the Region box — they are AWS edge network services, not regional VPC resources.

Managed services (DynamoDB, SQS, S3, Bedrock, etc.) that are region-scoped but not VPC-bound live **inside the Region** but **outside the VPC**.

### Page Setup

- Page size: A3 landscape (1587 × 1123) for complex diagrams; A4 landscape (1169 × 827) for simple ones
- Background: white `#FFFFFF`
- Grid: 10px (all coordinates snap to 10px grid)

### Spacing (snap to 10px)

| Context | Horizontal | Vertical |
|---------|-----------|---------|
| Between icons in same subnet | 120px | 80px |
| Subnet padding (icon → subnet edge) | 40px | 50px |
| Between AZs | 60px gap | — |
| Between VPC and edge services | 150px | — |
| Container label bar height (top) | — | 40px reserved |

### Title Block (upper-left, always include)

```xml
<mxCell id="title" value="Architecture Title"
  style="text;html=1;strokeColor=none;fillColor=none;align=left;
         verticalAlign=middle;fontSize=20;fontStyle=1;fontColor=#232F3E;"
  vertex="1" parent="1">
  <mxGeometry x="40" y="40" width="600" height="36" as="geometry"/>
</mxCell>
<mxCell id="subtitle" value="v1.0 | 2025-05 | ap-northeast-1"
  style="text;html=1;strokeColor=none;fillColor=none;align=left;
         verticalAlign=middle;fontSize=12;fontStyle=0;fontColor=#666666;"
  vertex="1" parent="1">
  <mxGeometry x="40" y="76" width="400" height="24" as="geometry"/>
</mxCell>
```

### Arrow Conventions

| Type | Style additions |
|------|----------------|
| Synchronous HTTPS / API call | `strokeColor=#232F3E;fontSize=11;` (solid, dark) |
| Async / event-driven | `dashed=1;strokeColor=#232F3E;` |
| Management / monitoring | `dashed=1;strokeColor=#999999;` |
| Bidirectional | `startArrow=block;startFill=1;endArrow=block;endFill=1;` |

Base arrow style (append the additions above):
```
edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;jettySize=auto;html=1;
```

Edge labels: use circled numbers for step sequences: ① ② ③ ④ ⑤ ⑥ ⑦ ⑧ ⑨ ⑩

---

## Common Architecture Patterns

### Pattern 1: Serverless REST API

```
User → ① CloudFront + WAF → ② API Gateway (Cognito auth) → ③ Lambda → ④ DynamoDB
                                                                    ↓
                                                               CloudWatch Logs
```

Services: CloudFront, WAF, API Gateway, Cognito, Lambda, DynamoDB, CloudWatch  
Layout: LR flow. CloudFront + WAF outside Region. API GW + Lambda + DynamoDB inside Region (managed services, outside VPC).

### Pattern 2: Three-Tier Web App (Multi-AZ HA)

```
User → Route 53 → CloudFront (+ WAF) → ALB (public subnet)
                                              ↓
                                  ECS Fargate / EC2 (private subnet, AZ-a + AZ-b)
                                              ↓
                                  Aurora PostgreSQL Multi-AZ (private subnet)
                                              ↓
                                  ElastiCache for Redis (private subnet)
```

Services: Route 53, CloudFront, WAF, ALB, ECS/EC2 in Auto Scaling Group, Aurora, ElastiCache, NAT Gateway, Secrets Manager  
Layout: LR or TB. Two AZ columns side by side to show redundancy.

### Pattern 3: Event-Driven Microservices

```
API GW → Lambda (Producer) → EventBridge → Lambda A (Consumer) → DynamoDB
                                          → Lambda B (Consumer) → S3
                                          → SQS (DLQ fallback)  → Lambda C
```

Services: API Gateway, Lambda, EventBridge, SQS, SNS, DynamoDB, S3  
Layout: TB. EventBridge/SQS in center row as the hub.

### Pattern 4: Generative AI / RAG Application

```
User → API GW → Lambda (Orchestrator) → Amazon Bedrock (Claude)
                        ↓                       ↑
                   OpenSearch Service ← S3 (Knowledge Base / docs)
                        ↓
                   DynamoDB (conversation history)
```

Services: API Gateway, Lambda, Amazon Bedrock, Amazon OpenSearch Service, S3, DynamoDB, Cognito  
Layout: LR for main flow; S3 + OpenSearch below as knowledge tier.

### Pattern 5: Data Lake & Analytics

```
Data Sources → Kinesis Firehose → S3 (raw zone)
                                        ↓
                                   AWS Glue (ETL)
                                        ↓
                                  S3 (processed zone)
                                        ↓
                          Athena (query) → QuickSight (BI)
```

Services: Kinesis Data Firehose, S3, Glue, Athena, QuickSight, Lake Formation  
Layout: TB pipeline style.

---

## Quality Checklist

Run through every item before step 7 final export:

**Icons & Style**
- [ ] All AWS services use `shape=mxgraph.aws4.resourceIcon` — no generic rectangles for AWS services
- [ ] `fillColor` matches the correct category color for each service
- [ ] Icon size is `60×60` uniformly; labels appear BELOW icons (not inside)
- [ ] Full official service names used as labels
- [ ] General icons (user, internet) use `#232F3E` fill

**Structure**
- [ ] AWS Cloud / Account boundary present if showing cloud context
- [ ] Region label present with code (ap-northeast-1, etc.)
- [ ] VPC has purple border and CIDR range in label
- [ ] Public subnets = green border; private subnets = blue border
- [ ] Internet Gateway placed at VPC edge; NAT Gateway in public subnet (if private outbound needed)
- [ ] Multi-AZ deployments shown in side-by-side AZ containers

**Data Flow**
- [ ] All arrows have arrowheads showing direction
- [ ] Every arrow has a label (protocol, operation, or step number)
- [ ] Step numbers ①②③ present if showing a request walkthrough
- [ ] No unnecessary crossing arrows (reroute or add waypoints)

**Presentation**
- [ ] Title block in upper-left (name + version/date)
- [ ] Legend present if any abbreviation or non-standard element is used
- [ ] Consistent 10px-grid spacing throughout
- [ ] No overlapping elements
- [ ] White background, clean layout
