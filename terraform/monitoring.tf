# Terraform configuration for monitoring infrastructure
# Sets up Prometheus, Grafana, and alerting for the Healthcare Management Application

# Prometheus server
resource "aws_instance" "prometheus" {
  ami           = var.monitoring_ami_id
  instance_type = "t3.small"
  subnet_id     = module.vpc.private_subnets[0]
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.monitoring_sg.id]
  
  iam_instance_profile = aws_iam_instance_profile.monitoring_profile.name
  
  user_data = templatefile("${path.module}/scripts/setup_prometheus.sh", {
    app_name    = var.app_name,
    environment = var.environment,
    region      = var.aws_region
  })
  
  tags = {
    Name        = "${var.app_name}-prometheus-${var.environment}",
    Environment = var.environment
  }
  
  root_block_device {
    volume_type           = "gp3",
    volume_size           = 40,
    delete_on_termination = true
  }
}

# Grafana server
resource "aws_instance" "grafana" {
  ami           = var.monitoring_ami_id
  instance_type = "t3.small"
  subnet_id     = module.vpc.private_subnets[0]
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.monitoring_sg.id]
  
  iam_instance_profile = aws_iam_instance_profile.monitoring_profile.name
  
  user_data = templatefile("${path.module}/scripts/setup_grafana.sh", {
    app_name       = var.app_name,
    environment    = var.environment,
    prometheus_url = "http://${aws_instance.prometheus.private_ip}:9090"
  })
  
  tags = {
    Name        = "${var.app_name}-grafana-${var.environment}",
    Environment = var.environment
  }
  
  root_block_device {
    volume_type           = "gp3",
    volume_size           = 20,
    delete_on_termination = true
  }
}

# Alertmanager server
resource "aws_instance" "alertmanager" {
  count         = var.environment == "production" ? 1 : 0
  ami           = var.monitoring_ami_id
  instance_type = "t3.small"
  subnet_id     = module.vpc.private_subnets[0]
  key_name      = var.key_name
  
  vpc_security_group_ids = [aws_security_group.monitoring_sg.id]
  
  user_data = templatefile("${path.module}/scripts/setup_alertmanager.sh", {
    app_name       = var.app_name,
    environment    = var.environment,
    slack_webhook  = var.slack_webhook_url,
    pagerduty_key  = var.pagerduty_key,
    email_from     = var.alert_email_from,
    email_to       = var.alert_email_to
  })
  
  tags = {
    Name        = "${var.app_name}-alertmanager-${var.environment}",
    Environment = var.environment
  }
}

# Security group for monitoring instances
resource "aws_security_group" "monitoring_sg" {
  name        = "${var.app_name}-monitoring-sg-${var.environment}"
  description = "Security group for monitoring servers"
  vpc_id      = module.vpc.vpc_id
  
  # Internal Prometheus access
  ingress {
    from_port       = 9090
    to_port         = 9090
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
    description     = "Prometheus API access from application servers"
  }
  
  # Internal Grafana access
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
    description     = "Grafana web UI access from application servers"
  }
  
  # Internal Alertmanager access
  ingress {
    from_port       = 9093
    to_port         = 9093
    protocol        = "tcp"
    security_groups = [aws_security_group.app_sg.id]
    description     = "Alertmanager access from application servers"
  }
  
  # VPN/Bastion access to monitoring UI
  ingress {
    from_port       = 9090
    to_port         = 9090
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion_sg.id]
    description     = "Prometheus UI access from bastion hosts"
  }
  
  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion_sg.id]
    description     = "Grafana UI access from bastion hosts"
  }
  
  ingress {
    from_port       = 9093
    to_port         = 9093
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion_sg.id]
    description     = "Alertmanager UI access from bastion hosts"
  }
  
  # SSH access
  ingress {
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion_sg.id]
    description     = "SSH access from bastion hosts"
  }
  
  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }
  
  tags = {
    Name        = "${var.app_name}-monitoring-sg",
    Environment = var.environment
  }
}

# IAM role for monitoring instances
resource "aws_iam_role" "monitoring_role" {
  name = "${var.app_name}-monitoring-role-${var.environment}"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
  
  tags = {
    Name        = "${var.app_name}-monitoring-role",
    Environment = var.environment
  }
}

# IAM instance profile for monitoring instances
resource "aws_iam_instance_profile" "monitoring_profile" {
  name = "${var.app_name}-monitoring-profile-${var.environment}"
  role = aws_iam_role.monitoring_role.name
}

# IAM policy for monitoring instances
resource "aws_iam_policy" "monitoring_policy" {
  name        = "${var.app_name}-monitoring-policy-${var.environment}"
  description = "Policy for monitoring servers"
  
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags",
          "cloudwatch:GetMetricData",
          "cloudwatch:ListMetrics",
          "cloudwatch:GetMetricStatistics",
          "logs:StartQuery",
          "logs:GetQueryResults"
        ],
        Effect   = "Allow",
        Resource = "*"
      },
      {
        Action = [
          "sns:Publish"
        ],
        Effect   = "Allow",
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# Attach policy to role
resource "aws_iam_role_policy_attachment" "monitoring_policy_attachment" {
  policy_arn = aws_iam_policy.monitoring_policy.arn
  role       = aws_iam_role.monitoring_role.name
}

# SNS topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.app_name}-alerts-${var.environment}"
  
  tags = {
    Name        = "${var.app_name}-alerts",
    Environment = var.environment
  }
}

# CloudWatch dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.app_name}-${var.environment}"
  
  dashboard_body = <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "cpu_usage_percent", { "stat": "Average" } ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${var.aws_region}",
        "title": "CPU Usage"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "memory_usage_bytes", "type", "system", { "stat": "Average" } ]
        ],
        "period": 300,
        "stat": "Average",
        "region": "${var.aws_region}",
        "title": "Memory Usage"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 24,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "http_request_duration_seconds", { "stat": "p95" } ]
        ],
        "period": 60,
        "stat": "p95",
        "region": "${var.aws_region}",
        "title": "API Response Time (p95)"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 12,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "appointments_booked_total", { "stat": "SampleCount", "period": 60 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${var.aws_region}",
        "title": "Appointments Booked Per Minute"
      }
    },
    {
      "type": "metric",
      "x": 8,
      "y": 12,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "patient_registrations_total", { "stat": "SampleCount", "period": 60 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${var.aws_region}",
        "title": "Patient Registrations Per Minute"
      }
    },
    {
      "type": "metric",
      "x": 16,
      "y": 12,
      "width": 8,
      "height": 6,
      "properties": {
        "metrics": [
          [ "${var.app_name}/${var.environment}", "prescriptions_created_total", { "stat": "SampleCount", "period": 60 } ]
        ],
        "view": "timeSeries",
        "stacked": false,
        "region": "${var.aws_region}",
        "title": "Prescriptions Created Per Minute"
      }
    }
  ]
}
EOF
}

# CloudWatch alarms for high CPU
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.app_name}-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "cpu_usage_percent"
  namespace           = "${var.app_name}/${var.environment}"
  period              = "60"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "This metric monitors high CPU usage"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    Environment = var.environment
  }
}

# CloudWatch alarms for slow API responses
resource "aws_cloudwatch_metric_alarm" "slow_api" {
  alarm_name          = "${var.app_name}-slow-api-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "http_request_duration_seconds"
  namespace           = "${var.app_name}/${var.environment}"
  period              = "60"
  statistic           = "p95"
  threshold           = "1.0"
  alarm_description   = "This metric monitors slow API responses"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    Environment = var.environment
  }
}

# CloudWatch alarm for high appointment booking rate
resource "aws_cloudwatch_metric_alarm" "high_appointment_rate" {
  alarm_name          = "${var.app_name}-high-appointment-rate-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "2"
  metric_name         = "appointments_booked_total"
  namespace           = "${var.app_name}/${var.environment}"
  period              = "60"
  statistic           = "SampleCount"
  threshold           = "10"
  alarm_description   = "This metric monitors high appointment booking rate"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  
  dimensions = {
    Environment = var.environment
  }
}

# Outputs
output "prometheus_endpoint" {
  value       = "http://${aws_instance.prometheus.private_ip}:9090"
  description = "Prometheus server endpoint"
}

output "grafana_endpoint" {
  value       = "http://${aws_instance.grafana.private_ip}:3000"
  description = "Grafana server endpoint"
}

output "alertmanager_endpoint" {
  value       = var.environment == "production" ? "http://${aws_instance.alertmanager[0].private_ip}:9093" : "Not enabled for this environment"
  description = "Alertmanager endpoint (production only)"
}