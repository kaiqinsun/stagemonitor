function renderAlertsTab() {

	var checkModalTemplate;
	var subscriptionModalTemplate;
	var metricCategories = {
		TIMER: {
			label: "Timer",
			metrics: ["count", "mean", "min", "max", "stddev", "p50", "p75", "p95", "p98", "p99", "p999",
				"mean_rate", "m1_rate", "m5_rate", "m15_rate"]
		},
		GAUGE: {
			label: "Gauge",
			metrics: ["value"]
		},
		METER: {
			label: "Meter",
			metrics: ["count", "mean_rate", "m1_rate", "m5_rate", "m15_rate"]
		},
		HISTOGRAM: {
			label: "Histogram",
			metrics: ["count", "mean", "min", "max", "stddev", "p50", "p75", "p95", "p98", "p99", "p999"]
		},
		COUNTER: {
			label: "Counter",
			metrics: ["count"]
		}
	};


	$.get("tabs/alerting-tab.html", function (tmpl) {
		var $tmpl = $(tmpl);
		var template = Handlebars.compile($tmpl.find("#alerts-content-template").html());
		checkModalTemplate = Handlebars.compile($tmpl.find("#check-modal-template").html());
		subscriptionModalTemplate = Handlebars.compile($tmpl.find("#subscription-modal-template").html());
		var tab = $("#stagemonitor-alerts");
		tab.html(template());

		initSideMenu();

		initializeValidation();
		incidentsPage();
		checksPage();
	});

	function initSideMenu() {
		// on selection from the side bar
		$("#alerting-side-menu").find("a").click(function () {
			var thisLink = $(this);
			$(".alerting-menu").removeClass("active");
			thisLink.parent().addClass("active");
			$(".alerting-content").addClass("hidden");
			var pluginId = thisLink.attr("href");
			$(pluginId).removeClass("hidden");
			return false;
		});
	}

	function initializeValidation() {
		window.ParsleyConfig = {
			errorClass: 'has-error',
			successClass: 'has-success',
			classHandler: function (ParsleyField) {
				return ParsleyField.$element.parents('.form-group');
			},
			errorsWrapper: '<span class="help-block">',
			errorTemplate: '<div></div>'
		};
	}

	function incidentsPage() {
		var incidents = [];
		var alerterTypes = ["Email", "PagerDuty", "SMS"];
		var subscriptionsById = {
			"cafebabe-6a82-4f1d-a8e5-11f08937668a" : {
				target: "f.barnsteiner@isys-software.de",
				alerterType: "Email",
				alertOnBackToOk: true,
				alertOnWarn: true,
				alertOnError: true,
				alertOnCritical: true
			}
		};

		$("#incidents-table").dataTable();

		$("#add-subscription").click(function(){
			renderSubscriptionModal("Add Subscription", {});
		});

		$("#subscriptions").on("click", ".edit-subscription", function(){
			renderSubscriptionModal("Edit Subscription", subscriptionsById[$(this).data('subscription-id')]);
		});


		function renderSubscriptionModal(title, subscription) {
			$("#subscription-modal-content").html(subscriptionModalTemplate({
				title: title,
				subscription: subscription,
				alerterTypes: alerterTypes
			}));
		}
	}

	function checksPage() {
		var checksById = {
			"e0bc261c-6a82-4f1d-a8e5-11f08937668a": {
				id: "e0bc261c-6a82-4f1d-a8e5-11f08937668a", name: "Search Response Time", alertAfterXFailures: "1",
				metricCategory: "TIMER", target: "request.*.time",
				thresholds: {
					"WARN": [
						{"metric": "p50", "operator": "GREATER", "thresholdValue": "5000"},
						{"metric": "p95", "operator": "GREATER", "thresholdValue": "10000"}
					],
					"ERROR": [
						{"metric": "m5_rate", "operator": "LESS", "thresholdValue": "0.01"}
					],
					"CRITICAL": []
				}
			}
		};

		var checksTable = $("#checks-table").dataTable({
			data: getData(),
			columns: [
				{ data: "name" },
				{ data: "target" },
				{ data: "alertAfterXFailures" },
				{
					render: function (data, type, full, meta) {
						return '<a href="#"><span class="edit-check glyphicon glyphicon-edit" aria-hidden="true" ' +
							'data-toggle="modal" data-target="#check-modal" data-check-id="' + full.id + '"></span></a>';
					}
				},
				{
					render: function (data, type, full, meta) {
						return '<a href="#"><span class="delete-check glyphicon glyphicon-remove" aria-hidden="true" ' +
							'data-check-id="' + full.id + '"></span></a>'
					}
				}
			]
		});

		$(".delete-check").click(function () {
			delete checksById[$(this).data('check-id')];
			updateChecksTable();
		});

		var $checkModal = $("#check-modal");
		$checkModal.on('click', "#save-check", function () {
			if ($("#check-form").parsley().validate()) {
				var check = getCheckFromForm();
				console.log(JSON.stringify(check));
				if (!check.id) {
					// TODO persist on server
					check.id = utils.generateUUID();
				}
				checksById[check.id] = check;

				updateChecksTable();
			}
		});


		$checkModal.on('change', "#metric-category-input", function () {
			renderCheckModal($("#check-modal-label").html(), getCheckFromForm());
		});

		$checkModal.on('click', ".remove-threshold", function () {
			$(this).parents(".threshold-form-group").remove();
			renderCheckModal($("#check-modal-label").html(), getCheckFromForm());
		});

		$checkModal.on('click', ".add-threshold", function () {
			var check = getCheckFromForm();
			check.thresholds[$(this).data('severity')].push({});
			renderCheckModal($("#check-modal-label").html(), check);
		});

		$("#checks-table").on("click", ".edit-check", function () {
			renderCheckModal("Edit Check", checksById[$(this).data('check-id')]);
		});

		$(".add-check").click(function () {
			renderCheckModal("Add Check", {alertAfterXFailures: 1, thresholds: {WARN: [], ERROR: [], CRITICAL: []}});
		});


		function getCheckFromForm() {
			var check = $("#check-form").serializeObject();
			check.thresholds = check.thresholds || {};
			check.thresholds.WARN = check.thresholds.WARN || [];
			check.thresholds.ERROR = check.thresholds.ERROR || [];
			check.thresholds.CRITICAL = check.thresholds.CRITICAL || [];
			return check;
		}

		function renderCheckModal(title, check) {
			$("#check-modal-content").html(checkModalTemplate({
				title: title,
				check: check,
				metricCategories: metricCategories,
				metrics: metricCategories[check.metricCategory || 'TIMER'].metrics
			}));
		}

		function updateChecksTable() {
			checksTable.fnClearTable(false);
			var data = getData();
			if (data.length > 0) {
				checksTable.fnAddData(data, false);
			}
			checksTable.DataTable().draw(false);
		}

		function getData() {
			var data = $.map(checksById, function (value, index) {
				return [value];
			});
			return data;
		}
	}
}