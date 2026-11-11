package com.gcrapp.valuation.ui.cases

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.gcrapp.valuation.data.models.ValuationCaseDto
import com.gcrapp.valuation.ui.components.AppTopBar
import com.gcrapp.valuation.ui.components.StatusBadge
import com.gcrapp.valuation.ui.theme.*

@Composable
fun CaseListScreen(
    viewModel: CaseListViewModel,
    onBack: () -> Unit,
    onNavigateToInspection: (String) -> Unit,
    onNavigateToReport: (String) -> Unit
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val filterOptions = listOf("All", "Pending", "In Progress", "Completed", "Approved")

    Scaffold(
        topBar = {
            AppTopBar(
                title = "Valuation Cases",
                subtitle = "${uiState.filteredCases.size} records found",
                showBackButton = true,
                onBackClick = onBack,
                onRefresh = { viewModel.loadCases(forceRefresh = true) }
            )
        },
        containerColor = Slate50
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Search Input
            OutlinedTextField(
                value = uiState.searchQuery,
                onValueChange = { viewModel.setSearchQuery(it) },
                placeholder = { Text("Search by client, survey #, bank...") },
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = PrimaryNavy) },
                trailingIcon = {
                    if (uiState.searchQuery.isNotBlank()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(Icons.Default.Clear, contentDescription = "Clear")
                        }
                    }
                },
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )

            // Filter Chips Row
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(filterOptions) { filter ->
                    val isSelected = uiState.selectedFilter.equals(filter, ignoreCase = true)
                    FilterChip(
                        selected = isSelected,
                        onClick = { viewModel.setFilter(filter) },
                        label = { Text(filter) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = PrimaryNavy,
                            selectedLabelColor = Color.White
                        )
                    )
                }
            }

            // Case List
            if (uiState.filteredCases.isEmpty() && !uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No valuation cases match your criteria.",
                        style = MaterialTheme.typography.bodyLarge.copy(color = Slate500)
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    items(uiState.filteredCases) { item ->
                        CaseListItemCard(
                            caseItem = item,
                            onInspectClick = { onNavigateToInspection(item.id) },
                            onReportClick = { onNavigateToReport(item.id) },
                            onNavigateGpsClick = {
                                val addr = item.address.ifBlank { "${item.bankBranch}, ${item.bankDistrict}" }
                                val intent = Intent(Intent.ACTION_VIEW, Uri.parse("geo:0,0?q=" + Uri.encode(addr)))
                                context.startActivity(intent)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun CaseListItemCard(
    caseItem: ValuationCaseDto,
    onInspectClick: () -> Unit,
    onReportClick: () -> Unit,
    onNavigateGpsClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onInspectClick() },
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = SurfaceLight),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = caseItem.clientName.ifBlank { "Untitled Valuation Case" },
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                )
                StatusBadge(status = caseItem.status)
            }

            Spacer(modifier = Modifier.height(6.dp))

            Text(
                text = "${caseItem.bankName} - ${caseItem.bankBranch} (${caseItem.bankDistrict})",
                style = MaterialTheme.typography.bodyMedium.copy(color = Slate700)
            )

            if (caseItem.address.isNotBlank()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Location: ${caseItem.address}",
                    style = MaterialTheme.typography.bodySmall.copy(color = Slate500),
                    maxLines = 1
                )
            }

            if (caseItem.propertyDetails.surveyNo.isNotBlank()) {
                Spacer(modifier = Modifier.height(2.dp))
                Text(
                    text = "Survey #: ${caseItem.propertyDetails.surveyNo} | Extent: ${caseItem.propertyDetails.netExtent.ifBlank { "N/A" }}",
                    style = MaterialTheme.typography.bodySmall.copy(color = Slate500)
                )
            }

            Spacer(modifier = Modifier.height(14.dp))
            HorizontalDivider(color = Slate200)
            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                OutlinedButton(
                    onClick = onNavigateGpsClick,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Navigation, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Nav", style = MaterialTheme.typography.labelSmall)
                }

                OutlinedButton(
                    onClick = onReportClick,
                    modifier = Modifier.weight(1f),
                    shape = RoundedCornerShape(8.dp),
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Description, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Report", style = MaterialTheme.typography.labelSmall)
                }

                Button(
                    onClick = onInspectClick,
                    modifier = Modifier.weight(1.3f),
                    shape = RoundedCornerShape(8.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryNavy),
                    contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
                ) {
                    Icon(Icons.Default.Edit, contentDescription = null, modifier = Modifier.size(14.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Inspect", style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Bold))
                }
            }
        }
    }
}
